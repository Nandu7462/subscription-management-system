from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.permissions import employee, admin
from app.db.session import get_db
from app.models import Payment, Invoice
from app.schemas.inputs import PaymentInput, ReversalInput
from app.api.common import get, public, page
from app.services.payment_service import record_payment, reverse_payment

router = APIRouter(tags=["Payments"])


@router.post("/invoices/{ident}/payments", status_code=201)
def record(ident: str, data: PaymentInput, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    return public(record_payment(db, ident, data, actor))


@router.get("/invoices/{ident}/payments")
def history(ident: str, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
            db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    get(db, Invoice, ident)
    return page(db, select(Payment).where(Payment.invoice_id == ident).order_by(Payment.created_at, Payment.id), offset, limit)


@router.get("/payments")
def listing(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
            db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    return page(db, select(Payment).order_by(Payment.created_at.desc(), Payment.id), offset, limit)


@router.get("/payments/{ident}")
def detail(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    return public(get(db, Payment, ident))


@router.post("/payments/{ident}/reverse")
def reverse(ident: str, data: ReversalInput, db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
    return public(reverse_payment(db, ident, data.reason, actor))
