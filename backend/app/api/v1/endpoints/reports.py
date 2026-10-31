from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import employee
from app.models import Subscription, Invoice, Payment
from app.api.common import public, page
from app.services import report_service as service

router = APIRouter(prefix="/reports", tags=["Reports"], dependencies=[Depends(employee)])


@router.get("/summary")
def summary(db: Session = Depends(get_db, scope="function")):
    return public(service.summary(db))


@router.get("/revenue")
def revenue(start_date: date, end_date: date, db: Session = Depends(get_db, scope="function")):
    return public(service.revenue(db, start_date, end_date))


@router.get("/subscriptions")
def subscriptions(db: Session = Depends(get_db, scope="function")):
    counts = dict(db.execute(select(Subscription.status, func.count()).group_by(Subscription.status)).all())
    return {status: counts.get(status, 0) for status in ("draft", "quotation", "confirmed", "active", "paused", "closed")}


@router.get("/payments")
def payments(start_date: date, end_date: date, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
             db: Session = Depends(get_db, scope="function")):
    service.period_check(start_date, end_date)
    stmt = select(Payment).where(Payment.reversed_at.is_(None), Payment.payment_date >= start_date,
                                  Payment.payment_date <= end_date).order_by(Payment.payment_date, Payment.id)
    result = page(db, stmt, offset, limit)
    result["collected_payments"] = public(service.total(db, Payment.amount, Payment.reversed_at.is_(None),
        Payment.payment_date >= start_date, Payment.payment_date <= end_date))
    return result


@router.get("/overdue-invoices")
def overdue(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100), db: Session = Depends(get_db, scope="function")):
    return page(db, select(Invoice).where(Invoice.status.in_(service.ISSUED),
        Invoice.due_date < date.today(), Invoice.total > Invoice.amount_paid).order_by(Invoice.due_date, Invoice.id), offset, limit)
