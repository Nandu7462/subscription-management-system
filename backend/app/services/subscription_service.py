from datetime import date, timedelta
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select
from app.models import (Subscription, SubscriptionLine, Plan, Product, ProductVariant,
                        Customer, PlanProduct, TaxRule)
from app.api.common import get, audit
from app.schemas.inputs import LineInput
from app.utils.money import money


def resolve_line(db, data):
    product = get(db, Product, data.product_id)
    if not product.is_active:
        raise HTTPException(409, "Product is archived")
    price = product.sales_price
    description = product.name
    if data.variant_id:
        variant = get(db, ProductVariant, data.variant_id)
        if variant.product_id != product.id:
            raise HTTPException(422, "Variant does not belong to the product")
        price += variant.price_extra
        description += f" ({variant.attribute_name}: {variant.attribute_value})"
    if data.tax_rule_id:
        get(db, TaxRule, data.tax_rule_id)
    return dict(product_id=product.id, variant_id=data.variant_id,
                quantity=data.quantity, unit_price=money(data.unit_price if data.unit_price is not None else price),
                tax_rule_id=data.tax_rule_id, description=description[:300])


def create_subscription(db, data, actor, validity_days=30):
    get(db, Customer, data.customer_id)
    plan = get(db, Plan, data.plan_id)
    if not plan.is_active or (plan.available_from and data.start_date < plan.available_from) or (
            plan.available_until and data.start_date > plan.available_until):
        raise HTTPException(409, "Plan is unavailable on the subscription start date")
    lines = data.lines
    if not lines:
        lines = [LineInput(product_id=p.product_id, quantity=p.default_quantity) for p in
                 db.scalars(select(PlanProduct).where(PlanProduct.plan_id == plan.id))]
    if (sum(line.quantity for line in lines) if lines else 1) < plan.minimum_quantity:
        raise HTTPException(422, "Subscription does not meet plan minimum quantity")
    sub = Subscription(number=f"SUB-{uuid4().hex.upper()}", customer_id=data.customer_id,
                       plan_id=plan.id, start_date=data.start_date, expiry_date=data.expiry_date,
                       next_billing_date=data.start_date, billing_anchor=data.start_date,
                       billing_interval=plan.billing_interval, plan_fee=plan.price,
                       payment_terms=data.payment_terms, quotation_validity_days=validity_days)
    sub.lines = [SubscriptionLine(**resolve_line(db, line)) for line in lines]
    db.add(sub)
    db.flush()
    audit(db, actor, "subscription.create", sub)
    return sub


def transition(db, sub, action, actor, renewal_date=None, today=None):
    from app.services.billing_service import bill_due
    today = today or date.today()
    plan = get(db, Plan, sub.plan_id)
    if action == "quote":
        if sub.status not in ("draft", "quotation"):
            raise HTTPException(409, "Only draft or quotation subscriptions can be quoted")
        sub.status = "quotation"
        sub.quotation_valid_until = today + timedelta(days=sub.quotation_validity_days)
    elif action == "confirm":
        if sub.status != "quotation":
            raise HTTPException(409, "Only a quotation can be confirmed")
        if sub.quotation_valid_until < today:
            raise HTTPException(409, "Quotation expired; reissue it before confirmation")
        sub.status = "confirmed"
    elif action == "activate":
        if sub.status != "confirmed" or (sub.expiry_date and sub.expiry_date < today):
            raise HTTPException(409, "Only unexpired confirmed subscriptions can be activated")
        sub.status = "active"
        bill_due(db, sub, today=today, actor=actor)
    elif action == "pause":
        if sub.status != "active" or not plan.allow_pause or (sub.expiry_date and sub.expiry_date < today):
            raise HTTPException(409, "Subscription cannot be paused")
        bill_due(db, sub, today=today, actor=actor)
        if sub.next_billing_date <= min(today, sub.expiry_date or today):
            raise HTTPException(409, "Run the billing worker to finish the backlog before pausing")
        sub.status, sub.paused_at = "paused", today
    elif action == "resume":
        if sub.status != "paused":
            raise HTTPException(409, "Only paused subscriptions can be resumed")
        duration = today - sub.paused_at
        # Freeze the next unpaid cycle and expiry during the pause; no retroactive pause charges.
        sub.next_billing_date += duration
        sub.billing_anchor, sub.billing_cycle = sub.next_billing_date, 0
        if sub.expiry_date:
            sub.expiry_date += duration
        sub.paused_at, sub.status = None, "active"
        bill_due(db, sub, today=today, actor=actor)
    elif action == "renew":
        if sub.status not in ("active", "closed") or not plan.allow_renewal:
            raise HTTPException(409, "Subscription cannot be renewed")
        if renewal_date is None or renewal_date <= max(today, sub.expiry_date or today):
            raise HTTPException(422, "New expiry must be after today and the current expiry")
        if sub.status == "closed":
            sub.billing_anchor = max(today, (sub.expiry_date + timedelta(days=1)) if sub.expiry_date else today)
            sub.next_billing_date, sub.billing_cycle = sub.billing_anchor, 0
            sub.status = "active"
        sub.expiry_date = renewal_date
        bill_due(db, sub, today=today, actor=actor)
    elif action == "close":
        if sub.status not in ("active", "paused", "confirmed"):
            raise HTTPException(409, "Subscription cannot be closed from its current state")
        if not plan.allow_early_close and (sub.expiry_date is None or today < sub.expiry_date):
            raise HTTPException(409, "Plan does not allow early closure")
        if sub.status == "active":
            bill_due(db, sub, today=today, actor=actor)
            if sub.next_billing_date <= min(today, sub.expiry_date or today):
                raise HTTPException(409, "Run the billing worker to finish the backlog before closing")
        sub.status = "closed"
    else:
        raise HTTPException(404, "Unknown subscription action")
    audit(db, actor, f"subscription.{action}", sub)
    db.flush()
    return sub
