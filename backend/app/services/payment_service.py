from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from app.api.common import get, audit
from app.models import Invoice, Payment
from app.utils.money import money


def payment_status(invoice):
    invoice.status = "paid" if invoice.amount_paid == invoice.total else (
        "partially_paid" if invoice.amount_paid else "confirmed")


def record_payment(db, invoice_id, data, actor):
    invoice = get(db, Invoice, invoice_id, lock=True)
    existing = db.scalar(select(Payment).where(Payment.idempotency_key == data.idempotency_key))
    if existing:
        if (existing.invoice_id != invoice.id or existing.amount != data.amount or existing.method != data.method
                or existing.payment_date != data.payment_date or existing.notes != data.notes):
            raise HTTPException(409, "Idempotency key already used for a different payment")
        return existing
    if invoice.status not in ("confirmed", "partially_paid"):
        raise HTTPException(409, "Only confirmed unpaid invoices accept payments")
    if data.amount > invoice.total - invoice.amount_paid:
        raise HTTPException(409, "Payment exceeds outstanding balance")
    payment = Payment(invoice_id=invoice.id, recorded_by=actor.id, **data.model_dump())
    db.add(payment)
    invoice.amount_paid = money(invoice.amount_paid + data.amount)
    payment_status(invoice)
    db.flush()
    audit(db, actor, "payment.record", payment, amount=data.amount, invoice_id=invoice.id)
    return payment


def reverse_payment(db, payment_id, reason, actor):
    payment = get(db, Payment, payment_id)
    invoice = get(db, Invoice, payment.invoice_id, lock=True)
    db.refresh(payment)
    if payment.reversed_at:
        raise HTTPException(409, "Payment already reversed")
    payment.reversed_at = datetime.now(timezone.utc)
    payment.reversal_reason = reason
    invoice.amount_paid = money(invoice.amount_paid - payment.amount)
    payment_status(invoice)
    audit(db, actor, "payment.reverse", payment, reason=reason)
    return payment
