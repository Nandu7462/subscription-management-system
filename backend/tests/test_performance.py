from datetime import date
import json
from time import perf_counter
from uuid import uuid4
from sqlalchemy import insert
from app.models import Subscription, Invoice
from conftest import subscription, request_ok


def test_three_thousand_records_paged_and_summary_under_two_seconds(env):
    client, factory, h, customer = env
    _, plan, _ = subscription(env)
    today = date.today()
    ids = [str(uuid4()) for _ in range(3000)]
    with factory.begin() as db:
        db.execute(insert(Subscription), [dict(id=ident, number="PERF-" + ident, customer_id=customer,
            plan_id=plan["id"], status="active", start_date=today, next_billing_date=today,
            billing_anchor=today, billing_cycle=0, billing_interval="monthly", plan_fee=100,
            payment_terms=14, quotation_validity_days=30) for ident in ids])
        db.execute(insert(Invoice), [dict(number="PERF-INV-" + ident, subscription_id=ident,
            customer_id=customer, billing_period=today, period_end=today, due_date=today,
            subtotal=100, discount=0, tax=0, total=100, amount_paid=0, status="confirmed",
            billing_name="Test Business", billing_address="", tax_number="") for ident in ids])
    timings = {}
    for endpoint in ("/subscriptions?limit=50", "/invoices?limit=50", "/reports/summary"):
        start = perf_counter()
        data = request_ok(client, "GET", endpoint, h["admin"])
        elapsed = perf_counter() - start
        timings[endpoint] = round(elapsed, 4)
        assert elapsed < 2, f"{endpoint} took {elapsed:.3f}s"
        if "items" in data:
            assert len(data["items"]) == 50
        else:
            assert data["active_subscriptions"] == 3000 and data["outstanding_amount"] == "300000.00"
    print("\n3000-record request timings (seconds): " + json.dumps(timings))
