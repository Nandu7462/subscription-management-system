"""Catch up all billable cycles before automatic expiry closure."""
from datetime import date
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models import Subscription, Plan
from app.api.common import audit
from app.jobs.generate_invoices import run_billing


def close_expired(today=None, session_factory=SessionLocal):
    today = today or date.today()
    closed = 0
    # Billing is independently committed for each subscription; failed cycles remain due.
    run_billing(today=today, session_factory=session_factory)
    with session_factory() as db:
        ids = db.scalars(select(Subscription.id).join(Plan).where(Plan.auto_close.is_(True),
            Subscription.status == "active", Subscription.expiry_date < today)).all()
    for ident in ids:
        with session_factory.begin() as db:
            sub = db.scalar(select(Subscription).where(Subscription.id == ident).with_for_update())
            if sub.status == "active" and sub.next_billing_date > sub.expiry_date:
                sub.status = "closed"
                audit(db, None, "subscription.auto_close", sub)
                closed += 1
    return {"closed": closed}


if __name__ == "__main__":
    print(close_expired())
