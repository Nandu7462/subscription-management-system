from datetime import date, timedelta, datetime, timezone
from decimal import Decimal
from email import policy
from email.parser import BytesParser
import re
import pytest
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from app.models import (Invoice, Subscription, User, Customer, DiscountRule, SubscriptionDiscount,
                        PasswordResetToken, Payment, AuditLog)
from app.services.billing_service import cycle_date, bill_due
from app.services.subscription_service import transition
from app.jobs.generate_invoices import run_billing
from app.jobs.close_expired import close_expired
from app.core.security import token_hash
from conftest import request_ok, subscription, activate, PASSWORD


def test_registration_login_and_roles(env):
    client, factory, headers, _ = env
    data = {"email": "New@Example.com", "password": PASSWORD, "business_name": "New"}
    user = request_ok(client, "POST", "/auth/register", {}, data, 201)
    assert user["email"] == "new@example.com" and "password_hash" not in user
    request_ok(client, "POST", "/auth/register", {}, dict(data, email="new@example.com"), 409)
    token = request_ok(client, "POST", "/auth/login", {}, {"email": "new@example.com", "password": PASSWORD})
    me = request_ok(client, "GET", "/auth/me", {"Authorization": "Bearer " + token["access_token"]})
    assert me["id"] == user["id"]
    request_ok(client, "POST", "/staff", headers["customer"], data, 403)
    request_ok(client, "POST", "/staff", headers["staff"], data, 403)
    request_ok(client, "GET", "/auth/me", {}, expected=401)
    request_ok(client, "POST", "/auth/login", {}, {"email": "new@example.com", "password": "bad"}, 401)


@pytest.mark.parametrize("password", ["Short!Aa", "nocapitals!", "NOLOWERCASE!", "NoSpecial123", "Aa!!!!!!"])
def test_password_validation(env, password):
    request_ok(env[0], "POST", "/auth/register", {}, {"email": "valid@example.com", "password": password}, 422)


def test_reset_single_use_and_session_revocation(env, tmp_path):
    client, factory, headers, _ = env
    request_ok(client, "POST", "/auth/forgot-password", {}, {"email": "customer@example.com"})
    from app.core.config import get_settings
    from pathlib import Path
    message = BytesParser(policy=policy.default).parsebytes(next(Path(get_settings().mail_directory).glob("*.eml")).read_bytes())
    token = re.search(r"token=([\w-]+)", message.get_body(preferencelist=("plain",)).get_content()).group(1)
    with factory() as db:
        stored = db.scalar(select(PasswordResetToken))
        assert stored.token_hash == token_hash(token) and stored.token_hash != token
    request_ok(client, "POST", "/auth/reset-password", {}, {"token": token, "password": "NewPassword!"})
    request_ok(client, "POST", "/auth/reset-password", {}, {"token": token, "password": "OtherPassword!"}, 400)
    request_ok(client, "GET", "/auth/me", headers["customer"], expected=401)
    request_ok(client, "POST", "/auth/login", {}, {"email": "customer@example.com", "password": "NewPassword!"})


def test_reset_expired(env):
    client, factory, _, _ = env
    with factory.begin() as db:
        user = db.scalar(select(User).where(User.role == "customer"))
        db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash("x" * 32),
                                 expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
    request_ok(client, "POST", "/auth/reset-password", {}, {"token": "x" * 32, "password": PASSWORD}, 400)


def test_admin_management(env):
    client, factory, h, _ = env
    staff = request_ok(client, "POST", "/staff", h["admin"], {"email": "newstaff@example.com", "password": PASSWORD}, 201)
    assert staff["role"] == "staff"
    with factory() as db:
        admin = db.scalar(select(User).where(User.role == "admin"))
    request_ok(client, "PATCH", f"/users/{admin.id}", h["admin"], {"is_active": False}, 409)
    request_ok(client, "PATCH", f"/users/{staff['id']}", h["admin"], {"is_active": False})


def test_validation_and_catalog_patches(env):
    client, _, h, _ = env
    request_ok(client, "POST", "/plans", h["admin"], {"name": "bad", "price": "-1", "billing_interval": "monthly"}, 422)
    sub, plan, product = subscription(env)
    request_ok(client, "PATCH", f"/plans/{plan['id']}", h["admin"],
               {"available_from": "2026-12-01", "available_until": "2026-01-01"}, 422)
    request_ok(client, "PATCH", f"/products/{product['id']}", h["admin"], {"sales_price": None}, 422)
    updated = request_ok(client, "PATCH", f"/products/{product['id']}", h["admin"], {"sales_price": "1500"})
    assert updated["sales_price"] == "1500.00"
    request_ok(client, "POST", "/products", h["staff"], {"name": "no", "sales_price": "10"}, 403)
    request_ok(client, "GET", "/products?limit=101", h["admin"], expected=422)
    request_ok(client, "DELETE", f"/products/{product['id']}", h["admin"])
    assert request_ok(client, "GET", "/products", h["customer"])["total"] == 0


def test_full_journey_variant_tax_discount_payments_reports_portal(env):
    client, factory, h, customer = env
    sub, plan, product = subscription(env)
    variant = request_ok(client, "POST", f"/products/{product['id']}/variants", h["admin"],
                         {"attribute_name": "Brand", "attribute_value": "Odoo", "price_extra": "560"}, 201)
    tax = request_ok(client, "POST", "/taxes", h["admin"], {"name": "Tax", "rate": "18"}, 201)
    data = {"name": "Offer", "plan_id": plan["id"], "validity_days": 10,
            "lines": [{"product_id": product["id"], "variant_id": variant["id"], "quantity": 2, "tax_rule_id": tax["id"]}]}
    template = request_ok(client, "POST", "/quotation-templates", h["staff"], data, 201)
    sub = request_ok(client, "POST", "/subscriptions/from-template", h["staff"],
                     {"template_id": template["id"], "customer_id": customer, "start_date": date.today().isoformat()}, 201)
    assert sub["lines"][0]["unit_price"] == "1560.00"
    discount = request_ok(client, "POST", "/discounts", h["admin"],
                          {"name": "Ten percent", "type": "percentage", "value": "10", "usage_limit": 1}, 201)
    request_ok(client, "POST", f"/subscriptions/{sub['id']}/discounts", h["staff"], {"discount_id": discount["id"]}, 201)
    activate(env, sub)
    inv = request_ok(client, "GET", "/invoices", h["staff"])["items"][0]
    assert (inv["subtotal"], inv["discount"], inv["tax"], inv["total"]) == ("3120.00", "312.00", "505.44", "3313.44")
    request_ok(client, "GET", f"/portal/invoices/{inv['id']}", h["customer"], expected=404)
    request_ok(client, "POST", f"/invoices/{inv['id']}/confirm", h["staff"])
    payment = {"amount": "2000", "method": "upi", "idempotency_key": "first-payment"}
    paid = request_ok(client, "POST", f"/invoices/{inv['id']}/payments", h["staff"], payment, 201)
    retry = request_ok(client, "POST", f"/invoices/{inv['id']}/payments", h["staff"], payment, 201)
    assert retry["id"] == paid["id"]
    request_ok(client, "POST", f"/invoices/{inv['id']}/payments", h["staff"], dict(payment, amount="2001"), 409)
    request_ok(client, "POST", f"/invoices/{inv['id']}/payments", h["staff"],
               dict(payment, amount="2000", idempotency_key="overpayment"), 409)
    assert request_ok(client, "GET", f"/portal/invoices/{inv['id']}", h["customer"])["outstanding_amount"] == "1313.44"
    summary = request_ok(client, "GET", "/reports/summary", h["staff"])
    assert summary["collected_payments"] == "2000.00" and summary["outstanding_amount"] == "1313.44"
    request_ok(client, "POST", f"/invoices/{inv['id']}/payments", h["staff"],
               dict(payment, amount="1313.44", idempotency_key="last-payment"), 201)
    assert request_ok(client, "GET", f"/invoices/{inv['id']}", h["admin"])["status"] == "paid"
    pdf = client.get(f"/api/v1/portal/invoices/{inv['id']}/pdf", headers=h["customer"])
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    request_ok(client, "POST", f"/invoices/{inv['id']}/send", h["staff"])
    request_ok(client, "POST", f"/invoices/{inv['id']}/cancel", h["staff"], expected=409)
    request_ok(client, "POST", f"/payments/{paid['id']}/reverse", h["admin"], {"reason": "Bank transfer reversed"})
    assert request_ok(client, "GET", f"/invoices/{inv['id']}", h["admin"])["status"] == "partially_paid"
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Payment)) == 2
        assert db.scalar(select(DiscountRule.usage_count)) == 1
        assert db.scalar(select(func.count()).select_from(AuditLog)) > 5


def test_ownership_enforced_on_every_portal_action(env):
    client, _, h, _ = env
    sub, _, _ = subscription(env)
    activate(env, sub)
    inv = request_ok(client, "GET", "/invoices", h["admin"])["items"][0]
    request_ok(client, "POST", f"/invoices/{inv['id']}/confirm", h["admin"])
    for prefix in ("", "/portal"):
        for path in (f"/subscriptions/{sub['id']}", f"/invoices/{inv['id']}", f"/invoices/{inv['id']}/pdf"):
            assert client.get("/api/v1" + prefix + path, headers=h["outsider"]).status_code == 404
        for action in ("pause", "resume", "close", "renew"):
            request_ok(client, "POST", prefix + f"/subscriptions/{sub['id']}/{action}", h["outsider"],
                       {"expiry_date": "2099-01-01"} if action == "renew" else None, 404)
        assert request_ok(client, "GET", prefix + "/invoices", h["outsider"])["total"] == 0
    request_ok(client, "GET", "/reports/summary", h["customer"], expected=403)
    request_ok(client, "POST", f"/subscriptions/{sub['id']}/activate", h["customer"], expected=403)


@pytest.mark.parametrize("anchor,interval,cycle,expected", [
    (date(2026, 1, 31), "monthly", 1, date(2026, 2, 28)),
    (date(2026, 1, 31), "monthly", 2, date(2026, 3, 31)),
    (date(2024, 2, 29), "yearly", 1, date(2025, 2, 28)),
    (date(2024, 2, 29), "yearly", 4, date(2028, 2, 29)),
    (date(2026, 1, 31), "weekly", 1, date(2026, 2, 7)),
    (date(2026, 1, 31), "daily", 1, date(2026, 2, 1)),
])
def test_calendar_anchors(anchor, interval, cycle, expected):
    assert cycle_date(anchor, interval, cycle) == expected


def test_catchup_worker_idempotence_and_unique_constraint(env):
    client, factory, h, _ = env
    sub, _, _ = subscription(env, start=date(2026, 1, 31))
    with factory.begin() as db:
        db.get(Subscription, sub["id"]).status = "active"
    first = run_billing(today=date(2026, 3, 31), session_factory=factory)
    second = run_billing(today=date(2026, 3, 31), session_factory=factory)
    assert first == {"generated": 3, "failures": 0} and second["generated"] == 0
    with factory() as db:
        invoices = db.scalars(select(Invoice).order_by(Invoice.billing_period)).all()
        assert [i.billing_period for i in invoices] == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31)]
        assert db.get(Subscription, sub["id"]).next_billing_date == date(2026, 4, 30)
        values = {c.key: getattr(invoices[0], c.key) for c in Invoice.__mapper__.column_attrs if c.key not in ("id", "created_at")}
        values["number"] = "different-number"
        db.add(Invoice(**values))
        with pytest.raises(IntegrityError):
            db.flush()


def test_failure_rolls_back_invoice_and_cursor(env, monkeypatch):
    _, factory, _, _ = env
    sub, _, _ = subscription(env, start=date(2026, 1, 31))
    with factory.begin() as db:
        db.get(Subscription, sub["id"]).status = "active"
    from app.services import billing_service
    original = billing_service.create_invoice
    def fail_after_creation(db, sub, actor):
        original(db, sub, actor)
        raise RuntimeError("Simulated failure after invoice insert")
    monkeypatch.setattr(billing_service, "create_invoice", fail_after_creation)
    assert run_billing(today=date(2026, 2, 1), session_factory=factory)["failures"] == 1
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Invoice)) == 0
        assert db.get(Subscription, sub["id"]).next_billing_date == date(2026, 1, 31)
    monkeypatch.setattr(billing_service, "create_invoice", original)
    assert run_billing(today=date(2026, 2, 1), session_factory=factory)["generated"] == 1


def test_expiry_catches_up_before_close(env):
    _, factory, _, _ = env
    sub, _, _ = subscription(env, start=date(2026, 1, 1))
    with factory.begin() as db:
        item = db.get(Subscription, sub["id"])
        item.status, item.expiry_date = "active", date(2026, 3, 15)
    assert close_expired(today=date(2026, 5, 1), session_factory=factory)["closed"] == 1
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Invoice)) == 3
        assert db.get(Subscription, sub["id"]).status == "closed"


def test_pause_resume_freezes_billing_and_policy(env):
    client, factory, h, _ = env
    sub, _, _ = subscription(env, start=date(2026, 1, 1))
    with factory.begin() as db:
        item = db.get(Subscription, sub["id"])
        actor = db.scalar(select(User).where(User.role == "admin"))
        item.status = "active"
        transition(db, item, "pause", actor, today=date(2026, 1, 10))
        assert item.next_billing_date == date(2026, 2, 1)
        assert bill_due(db, item, today=date(2026, 3, 1)) == []
        transition(db, item, "resume", actor, today=date(2026, 2, 10))
        assert item.next_billing_date == date(2026, 3, 4)
    other, _, _ = subscription(env, plan_options={"allow_pause": False})
    activate(env, other)
    request_ok(client, "POST", f"/subscriptions/{other['id']}/pause", h["customer"], expected=409)


def test_expired_quote_invalid_transition_and_renewal(env):
    client, factory, h, _ = env
    sub, _, _ = subscription(env)
    request_ok(client, "POST", f"/subscriptions/{sub['id']}/activate", h["admin"], expected=409)
    request_ok(client, "POST", f"/subscriptions/{sub['id']}/quote", h["admin"])
    with factory.begin() as db:
        db.get(Subscription, sub["id"]).quotation_valid_until = date.today() - timedelta(days=1)
    request_ok(client, "POST", f"/subscriptions/{sub['id']}/confirm", h["staff"], expected=409)
    activate(env, sub)
    request_ok(client, "POST", f"/subscriptions/{sub['id']}/close", h["customer"])
    request_ok(client, "POST", f"/subscriptions/{sub['id']}/activate", h["admin"], expected=409)
    renewed = request_ok(client, "POST", f"/portal/subscriptions/{sub['id']}/renew", h["customer"],
                         {"expiry_date": (date.today() + timedelta(days=366)).isoformat()})
    assert renewed["status"] == "active"


@pytest.mark.parametrize("changes,expected", [
    ({"end_date": date(2025, 12, 31)}, "0.00"),
    ({"start_date": date(2026, 2, 1)}, "0.00"),
    ({"min_purchase": Decimal("9999")}, "0.00"),
    ({"min_quantity": 99}, "0.00"),
    ({"usage_limit": 1, "usage_count": 1}, "0.00"),
    ({"type": "fixed", "value": Decimal("3000")}, "2000.00"),
    ({}, "200.00"),
])
def test_discount_eligibility_and_caps(env, changes, expected):
    _, factory, _, _ = env
    sub, _, _ = subscription(env, start=date(2026, 1, 1))
    with factory.begin() as db:
        values = dict(name="Discount", type="percentage", value=Decimal("10"))
        values.update(changes)
        rule = DiscountRule(**values)
        db.add(rule)
        db.flush()
        db.add(SubscriptionDiscount(subscription_id=sub["id"], discount_id=rule.id))
        item = db.get(Subscription, sub["id"])
        item.status = "active"
        invoice = bill_due(db, item, today=date(2026, 1, 1))[0]
        assert str(invoice.discount) == expected


def test_financial_snapshots_and_cancelled_cycle_not_rebilled(env):
    client, factory, h, _ = env
    sub, plan, product = subscription(env, price="100")
    activate(env, sub)
    invoice = request_ok(client, "GET", "/invoices", h["admin"])["items"][0]
    assert invoice["total"] == "2100.00" and len(invoice["lines"]) == 2
    request_ok(client, "PATCH", f"/products/{product['id']}", h["admin"], {"sales_price": "9999"})
    request_ok(client, "PATCH", f"/plans/{plan['id']}", h["admin"], {"price": "9999"})
    assert request_ok(client, "GET", f"/invoices/{invoice['id']}", h["admin"])["total"] == "2100.00"
    request_ok(client, "POST", f"/invoices/{invoice['id']}/cancel", h["staff"])
    assert request_ok(client, "POST", f"/subscriptions/{sub['id']}/invoices/generate", h["staff"])["count"] == 0


def test_rate_limit(env):
    client = env[0]
    for _ in range(20):
        request_ok(client, "POST", "/auth/forgot-password", {}, {"email": "missing@example.com"})
    request_ok(client, "POST", "/auth/forgot-password", {}, {"email": "missing@example.com"}, 429)


def test_report_overdue_and_date_filters(env):
    client, factory, h, _ = env
    sub, _, _ = subscription(env)
    activate(env, sub)
    invoice = request_ok(client, "GET", "/invoices", h["admin"])["items"][0]
    assert request_ok(client, "GET", "/reports/summary", h["staff"])["invoiced_amount"] == "0.00"
    request_ok(client, "POST", f"/invoices/{invoice['id']}/confirm", h["staff"])
    with factory.begin() as db:
        db.get(Invoice, invoice["id"]).due_date = date.today() - timedelta(days=1)
    assert request_ok(client, "GET", "/reports/overdue-invoices", h["staff"])["total"] == 1
    request_ok(client, "GET", "/reports/revenue?start_date=2026-02-01&end_date=2026-01-01", h["staff"], expected=422)
    report = request_ok(client, "GET", f"/reports/revenue?start_date={date.today()}&end_date={date.today()}", h["staff"])
    assert report["invoiced_amount"] == "2000.00"


@pytest.mark.parametrize("action", ["pause", "close"])
def test_unprocessed_backlog_cannot_be_abandoned(env, monkeypatch, action):
    client, factory, h, _ = env
    start = date.today() - timedelta(days=3)
    sub, _, _ = subscription(env, start=start, interval="daily")
    with factory.begin() as db:
        db.get(Subscription, sub["id"]).status = "active"
    from app.services import billing_service
    original = billing_service.bill_due
    def limited(db, sub, today=None, actor=None):
        return original(db, sub, today=today, actor=actor, max_cycles=1)
    monkeypatch.setattr(billing_service, "bill_due", limited)
    request_ok(client, "POST", f"/subscriptions/{sub['id']}/{action}", h["staff"], expected=409)
    with factory() as db:
        assert db.get(Subscription, sub["id"]).status == "active"
        assert db.get(Subscription, sub["id"]).next_billing_date == start
        assert db.scalar(select(func.count()).select_from(Invoice)) == 0


def test_invoice_monetary_overflow_rejected_without_advancing_cursor(env):
    client, factory, h, customer = env
    sub, plan, product = subscription(env)
    sub = request_ok(client, "POST", "/subscriptions", h["staff"], {
        "customer_id": customer, "plan_id": plan["id"], "start_date": date.today().isoformat(),
        "lines": [{"product_id": product["id"], "quantity": 1000000, "unit_price": "999999999999.99"}]}, 201)
    for action in ("quote", "confirm"):
        request_ok(client, "POST", f"/subscriptions/{sub['id']}/{action}", h["staff"])
    request_ok(client, "POST", f"/subscriptions/{sub['id']}/activate", h["staff"], expected=422)
    with factory() as db:
        assert db.get(Subscription, sub["id"]).status == "confirmed"
        assert db.scalar(select(func.count()).select_from(Invoice)) == 0


def test_patch_database_conflict_is_reported_before_response(env):
    client, _, h, _ = env
    _, _, product = subscription(env)
    values = {"attribute_name": "Brand", "attribute_value": "One"}
    first = request_ok(client, "POST", f"/products/{product['id']}/variants", h["admin"], values, 201)
    second = request_ok(client, "POST", f"/products/{product['id']}/variants", h["admin"], dict(values, attribute_value="Two"), 201)
    request_ok(client, "PATCH", f"/variants/{second['id']}", h["admin"], {"attribute_value": "One"}, 409)


def test_reset_delivery_failure_does_not_reveal_account(env, monkeypatch):
    client = env[0]
    from app.services import auth_service
    def failed_mail(*args, **kwargs):
        raise OSError("Simulated mail failure")
    monkeypatch.setattr(auth_service, "send_email", failed_mail)
    known = request_ok(client, "POST", "/auth/forgot-password", {}, {"email": "customer@example.com"})
    missing = request_ok(client, "POST", "/auth/forgot-password", {}, {"email": "missing@example.com"})
    assert known == missing
