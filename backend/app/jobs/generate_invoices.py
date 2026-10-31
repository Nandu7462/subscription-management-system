"""Run once per schedule: python -m app.jobs.generate_invoices"""
from datetime import date
import logging
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models import Subscription, BillingJobLog
from app.services.billing_service import bill_due

logger = logging.getLogger(__name__)


def run_billing(today=None, batch_size=100, max_cycles=1000, session_factory=SessionLocal):
    today = today or date.today()
    created, failures, cursor = 0, 0, ""
    while True:
        with session_factory() as db:
            ids = db.scalars(select(Subscription.id).where(Subscription.id > cursor,
                Subscription.status == "active", Subscription.next_billing_date <= today)
                .order_by(Subscription.id).limit(batch_size)).all()
        if not ids:
            break
        for ident in ids:
            try:
                with session_factory.begin() as db:
                    sub = db.scalar(select(Subscription).where(Subscription.id == ident)
                                    .with_for_update(skip_locked=True))
                    if sub is None:
                        continue
                    invoices = bill_due(db, sub, today=today, max_cycles=max_cycles)
                    db.add(BillingJobLog(subscription_id=ident, success=True,
                                        message=f"Generated {len(invoices)} invoice(s)"))
                    count = len(invoices)
                created += count
            except Exception as exc:
                failures += 1
                logger.exception("Billing failed for subscription %s", ident)
                with session_factory.begin() as db:
                    db.add(BillingJobLog(subscription_id=ident, success=False,
                                        message=f"Billing transaction failed: {type(exc).__name__}"))
        cursor = ids[-1]
    return {"generated": created, "failures": failures}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = run_billing()
    print(result)
    if result["failures"]:
        raise SystemExit(1)
