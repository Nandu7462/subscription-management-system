from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.permissions import current_user, employee, own, customer_id
from app.db.session import get_db
from app.models import Invoice, Subscription, Customer, User
from app.api.common import get, public, page, audit
from app.services.billing_service import bill_due
from app.utils.pdf import invoice_pdf
from app.utils.email import send_email

router = APIRouter(tags=["Invoices"])


@router.get("/invoices")
def listing(status: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
            db: Session = Depends(get_db, scope="function"), actor=Depends(current_user)):
    stmt = select(Invoice).order_by(Invoice.billing_period.desc(), Invoice.created_at.desc(), Invoice.id)
    if actor.role == "customer":
        stmt = stmt.where(Invoice.customer_id == customer_id(db, actor), Invoice.status != "draft")
    if status:
        stmt = stmt.where(Invoice.status == status)
    return page(db, stmt, offset, limit)


def accessible_invoice(db, actor, ident):
    invoice = own(db, actor, get(db, Invoice, ident))
    if actor.role == "customer" and invoice.status == "draft":
        raise HTTPException(404, "Invoice not found")
    return invoice


@router.get("/invoices/{ident}")
def detail(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(current_user)):
    return public(accessible_invoice(db, actor, ident))


@router.post("/subscriptions/{ident}/invoices/generate")
def generate(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    sub = get(db, Subscription, ident, lock=True)
    if sub.status != "active":
        raise HTTPException(409, "Subscription is not active")
    items = bill_due(db, sub, actor=actor)
    return {"items": public(items), "count": len(items), "next_billing_date": sub.next_billing_date.isoformat()}


@router.post("/invoices/{ident}/confirm")
def confirm(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    invoice = get(db, Invoice, ident, lock=True)
    if invoice.status != "draft":
        raise HTTPException(409, "Only draft invoices can be confirmed")
    invoice.status = "paid" if invoice.total == 0 else "confirmed"
    audit(db, actor, "invoice.confirm", invoice)
    return public(invoice)


@router.post("/invoices/{ident}/cancel")
def cancel(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    invoice = get(db, Invoice, ident, lock=True)
    if invoice.status not in ("draft", "confirmed") or invoice.amount_paid:
        raise HTTPException(409, "Only unpaid draft or confirmed invoices can be cancelled")
    invoice.status = "cancelled"
    audit(db, actor, "invoice.cancel", invoice)
    return public(invoice)


@router.get("/invoices/{ident}/pdf")
def pdf(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(current_user)):
    invoice = accessible_invoice(db, actor, ident)
    return Response(invoice_pdf(invoice), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{invoice.number}.pdf"'})


@router.post("/invoices/{ident}/send")
def send(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    invoice = get(db, Invoice, ident)
    if invoice.status in ("draft", "cancelled"):
        raise HTTPException(409, "Confirm an invoice before sending it")
    customer = get(db, Customer, invoice.customer_id)
    user = get(db, User, customer.user_id)
    send_email(user.email, f"Invoice {invoice.number}",
               f"Your invoice total is {invoice.total:.2f}, due {invoice.due_date}.",
               (f"{invoice.number}.pdf", invoice_pdf(invoice)))
    audit(db, actor, "invoice.send", invoice)
    return {"message": "Invoice sent"}
