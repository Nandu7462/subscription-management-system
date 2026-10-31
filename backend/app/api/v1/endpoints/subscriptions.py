from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.permissions import current_user, employee, own, customer_id
from app.db.session import get_db
from app.models import Subscription, QuotationTemplate, SubscriptionDiscount, DiscountRule
from app.schemas.inputs import SubscriptionInput, FromTemplate, Renew, AssignDiscount
from app.api.common import get, public, page, audit
from app.services.subscription_service import create_subscription, transition

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.post("", status_code=201)
def create(data: SubscriptionInput, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    return public(create_subscription(db, data, actor))


@router.post("/from-template", status_code=201)
def from_template(data: FromTemplate, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    template = get(db, QuotationTemplate, data.template_id)
    lines = [dict(product_id=l.product_id, variant_id=l.variant_id, quantity=l.quantity,
                  unit_price=l.unit_price, tax_rule_id=l.tax_rule_id) for l in template.lines]
    values = data.model_dump(exclude={"template_id"})
    values.update(plan_id=template.plan_id, lines=lines)
    sub = create_subscription(db, SubscriptionInput(**values), actor, template.validity_days)
    return public(sub)


@router.get("")
def listing(status: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
            db: Session = Depends(get_db, scope="function"), actor=Depends(current_user)):
    stmt = select(Subscription).order_by(Subscription.created_at, Subscription.id)
    if actor.role == "customer":
        stmt = stmt.where(Subscription.customer_id == customer_id(db, actor))
    if status:
        stmt = stmt.where(Subscription.status == status)
    return page(db, stmt, offset, limit)


@router.get("/{ident}")
def detail(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(current_user)):
    return public(own(db, actor, get(db, Subscription, ident)))


def action_route(action, permitted):
    def handle(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(permitted)):
        sub = own(db, actor, get(db, Subscription, ident, lock=True))
        return public(transition(db, sub, action, actor))
    router.add_api_route(f"/{{ident}}/{action}", handle, methods=["POST"], name=f"subscription_{action}")


for action in ("quote", "confirm", "activate"):
    action_route(action, employee)
for action in ("pause", "resume", "close"):
    action_route(action, current_user)


@router.post("/{ident}/renew")
def renew(ident: str, data: Renew, db: Session = Depends(get_db, scope="function"), actor=Depends(current_user)):
    sub = own(db, actor, get(db, Subscription, ident, lock=True))
    return public(transition(db, sub, "renew", actor, renewal_date=data.expiry_date))


@router.post("/{ident}/discounts", status_code=201)
def assign_discount(ident: str, data: AssignDiscount, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    sub = get(db, Subscription, ident, lock=True)
    rule = get(db, DiscountRule, data.discount_id)
    if sub.status == "closed" or not rule.is_active or (rule.subscription_id and rule.subscription_id != sub.id):
        raise HTTPException(409, "Discount cannot be assigned to this subscription")
    if (rule.end_date and rule.end_date < date.today()) or (rule.usage_limit is not None and rule.usage_count >= rule.usage_limit):
        raise HTTPException(409, "Discount expired or exhausted")
    if rule.product_id and all(line.product_id != rule.product_id for line in sub.lines):
        raise HTTPException(422, "Subscription has no eligible product")
    link = SubscriptionDiscount(subscription_id=sub.id, discount_id=rule.id)
    db.add(link)
    db.flush()
    audit(db, actor, "subscription.discount.assign", sub, discount_id=rule.id)
    return public(link)


@router.get("/{ident}/discounts")
def assigned_discounts(ident: str, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
                       db: Session = Depends(get_db, scope="function"), actor=Depends(current_user)):
    own(db, actor, get(db, Subscription, ident))
    return page(db, select(DiscountRule).join(SubscriptionDiscount,
        SubscriptionDiscount.discount_id == DiscountRule.id).where(
        SubscriptionDiscount.subscription_id == ident).order_by(DiscountRule.id), offset, limit)
