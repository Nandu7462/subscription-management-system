from datetime import date
from fastapi import HTTPException
from sqlalchemy import select, func
from app.models import Subscription, Invoice, Payment
from app.utils.money import ZERO, money

ISSUED = ("confirmed", "partially_paid", "paid")


def total(db, column, *conditions):
    return money(db.scalar(select(func.coalesce(func.sum(column), 0)).where(*conditions)))


def summary(db):
    return dict(
        active_subscriptions=db.scalar(select(func.count()).select_from(Subscription).where(Subscription.status == "active")),
        invoiced_amount=total(db, Invoice.total, Invoice.status.in_(ISSUED)),
        collected_payments=total(db, Payment.amount, Payment.reversed_at.is_(None)),
        outstanding_amount=total(db, Invoice.total - Invoice.amount_paid, Invoice.status.in_(ISSUED)),
        overdue_invoices=db.scalar(select(func.count()).select_from(Invoice).where(
            Invoice.status.in_(ISSUED), Invoice.due_date < date.today(), Invoice.total > Invoice.amount_paid)))


def period_check(start, end):
    if end < start:
        raise HTTPException(422, "end_date precedes start_date")


def revenue(db, start, end):
    period_check(start, end)
    return {"start_date": start, "end_date": end,
            "invoiced_amount": total(db, Invoice.total, Invoice.status.in_(ISSUED),
                                     Invoice.billing_period >= start, Invoice.billing_period <= end),
            "collected_payments": total(db, Payment.amount, Payment.reversed_at.is_(None),
                                        Payment.payment_date >= start, Payment.payment_date <= end)}
