from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from threading import Barrier
import pytest
from sqlalchemy import select, func
from fastapi import HTTPException
from app.api.common import get
from app.models import Invoice, Subscription, User, Payment, DiscountRule, SubscriptionDiscount
from app.services.billing_service import bill_due
from app.services.payment_service import record_payment
from app.schemas.inputs import PaymentInput
from conftest import subscription, activate


def require_pg(factory):
    if factory.kw["bind"].dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock test; run with --postgres")


def test_concurrent_billing_same_cycle(env):
    _, factory, _, _ = env
    require_pg(factory)
    sub, _, _ = subscription(env)
    with factory.begin() as db:
        db.get(Subscription, sub["id"]).status = "active"
    barrier = Barrier(2)
    def bill(_):
        barrier.wait(timeout=10)
        with factory.begin() as db:
            item = get(db, Subscription, sub["id"], lock=True)
            return len(bill_due(db, item))
    with ThreadPoolExecutor(2) as executor:
        assert sorted(executor.map(bill, range(2))) == [0, 1]
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Invoice)) == 1


def test_concurrent_payments_cannot_overpay(env):
    _, factory, _, _ = env
    require_pg(factory)
    sub, _, _ = subscription(env)
    activate(env, sub)
    with factory.begin() as db:
        invoice = db.scalar(select(Invoice))
        invoice.status = "confirmed"
        invoice_id = invoice.id
        actor_id = db.scalar(select(User.id).where(User.role == "staff"))
    barrier = Barrier(2)
    def pay(index):
        barrier.wait(timeout=10)
        try:
            with factory.begin() as db:
                record_payment(db, invoice_id, PaymentInput(amount="1500", method="upi",
                    idempotency_key=f"concurrent-{index}"), db.get(User, actor_id))
            return 201
        except HTTPException as exc:
            return exc.status_code
    with ThreadPoolExecutor(2) as executor:
        assert sorted(executor.map(pay, range(2))) == [201, 409]
    with factory() as db:
        assert db.get(Invoice, invoice_id).amount_paid == Decimal("1500")
        assert db.scalar(select(func.count()).select_from(Payment)) == 1


def test_global_discount_limit_across_concurrent_subscriptions(env):
    _, factory, _, _ = env
    require_pg(factory)
    first, _, _ = subscription(env)
    second, _, _ = subscription(env)
    with factory.begin() as db:
        rule = DiscountRule(name="One use", type="percentage", value=Decimal("10"), usage_limit=1)
        db.add(rule)
        db.flush()
        for sub in (first, second):
            db.get(Subscription, sub["id"]).status = "active"
            db.add(SubscriptionDiscount(subscription_id=sub["id"], discount_id=rule.id))
    barrier = Barrier(2)
    def bill(ident):
        barrier.wait(timeout=10)
        with factory.begin() as db:
            item = get(db, Subscription, ident, lock=True)
            return bill_due(db, item)[0].discount
    with ThreadPoolExecutor(2) as executor:
        assert sorted(executor.map(bill, [first["id"], second["id"]])) == [Decimal("0"), Decimal("200")]
