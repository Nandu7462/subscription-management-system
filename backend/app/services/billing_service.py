from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from fastapi import HTTPException
from app.models import (Invoice, InvoiceLine, Customer, TaxRule, DiscountRule,
                        SubscriptionDiscount, DiscountRedemption)
from app.api.common import audit
from app.utils.money import money, ZERO


def cycle_date(anchor, interval, cycle):
    if interval == "daily":
        return anchor + timedelta(days=cycle)
    if interval == "weekly":
        return anchor + timedelta(weeks=cycle)
    if interval == "monthly":
        return anchor + relativedelta(months=cycle)
    if interval == "yearly":
        return anchor + relativedelta(years=cycle)
    raise ValueError("Invalid billing interval")


def valid_on(rule, day):
    return rule.is_active and (not rule.start_date or rule.start_date <= day) and (
        not rule.end_date or rule.end_date >= day)


def create_invoice(db, sub, actor=None):
    period = sub.next_billing_date
    next_date = cycle_date(sub.billing_anchor, sub.billing_interval, sub.billing_cycle + 1)
    existing = db.scalar(select(Invoice).where(Invoice.subscription_id == sub.id,
                                              Invoice.billing_period == period))
    if existing:
        # Reconcile a previously persisted cycle; never bill it again, even if cancelled.
        sub.billing_cycle += 1
        sub.next_billing_date = next_date
        return existing
    customer = db.get(Customer, sub.customer_id)
    invoice = Invoice(number=f"INV-{uuid4().hex.upper()}", subscription_id=sub.id,
                      customer_id=sub.customer_id, billing_period=period,
                      period_end=min(next_date - timedelta(days=1), sub.expiry_date) if sub.expiry_date else next_date - timedelta(days=1),
                      due_date=period + timedelta(days=sub.payment_terms),
                      billing_name=customer.business_name, billing_address=customer.billing_address,
                      tax_number=customer.tax_number, subtotal=ZERO, discount=ZERO, tax=ZERO, total=ZERO)
    rows = [dict(product_id=line.product_id, description=line.description, quantity=line.quantity,
                 unit_price=line.unit_price, tax_rule_id=line.tax_rule_id) for line in sub.lines]
    if sub.plan_fee:
        rows.insert(0, dict(product_id=None, description="Recurring plan fee", quantity=1,
                            unit_price=sub.plan_fee, tax_rule_id=None))
    # All workers lock shared discount rules in the same order before checking usage limits.
    discounts = db.scalars(select(DiscountRule).join(SubscriptionDiscount,
        SubscriptionDiscount.discount_id == DiscountRule.id).where(
        SubscriptionDiscount.subscription_id == sub.id).order_by(DiscountRule.id).with_for_update(of=DiscountRule)).all()
    subtotal = sum((money(r["quantity"] * r["unit_price"]) for r in rows), ZERO)
    quantity = sum(r["quantity"] for r in rows if r["product_id"] is not None) or 1
    eligible = [d for d in discounts if valid_on(d, period) and subtotal >= d.min_purchase
                and quantity >= d.min_quantity and (not d.subscription_id or d.subscription_id == sub.id)
                and (d.usage_limit is None or d.usage_count < d.usage_limit)]
    remaining = {d.id: d.value for d in eligible}
    used = defaultdict(lambda: ZERO)
    for row in rows:
        base = money(row["unit_price"] * row["quantity"])
        reduction = ZERO
        # Deterministic rule priority (ID order); at most one rule per line.
        for rule in eligible:
            if rule.product_id and rule.product_id != row["product_id"]:
                continue
            candidate = money(base * rule.value / Decimal(100)) if rule.type == "percentage" else min(base, remaining[rule.id])
            if candidate <= 0:
                continue
            reduction = min(base, candidate)
            if rule.type == "fixed":
                remaining[rule.id] -= reduction
            used[rule.id] += reduction
            break
        tax_rule = db.get(TaxRule, row["tax_rule_id"]) if row["tax_rule_id"] else None
        rate = tax_rule.rate if tax_rule and valid_on(tax_rule, period) else ZERO
        tax = money((base - reduction) * rate / Decimal(100))
        total = money(base - reduction + tax)
        invoice.lines.append(InvoiceLine(product_id=row["product_id"], description=row["description"],
                             quantity=row["quantity"], unit_price=row["unit_price"], tax_rate=rate,
                             discount_amount=reduction, tax_amount=tax, line_total=total))
        invoice.subtotal += base
        invoice.discount += reduction
        invoice.tax += tax
        invoice.total += total
    if max(invoice.subtotal, invoice.total, invoice.tax, invoice.discount) > Decimal("999999999999.99"):
        raise HTTPException(422, "Invoice exceeds the supported monetary limit")
    db.add(invoice)
    db.flush()
    for rule in eligible:
        if used[rule.id] > 0:
            rule.usage_count += 1
            db.add(DiscountRedemption(discount_id=rule.id, invoice_id=invoice.id, amount=used[rule.id]))
    sub.billing_cycle += 1
    sub.next_billing_date = next_date
    audit(db, actor, "invoice.generate", invoice, billing_period=period)
    db.flush()
    return invoice


def bill_due(db, sub, today=None, actor=None, max_cycles=1000):
    """Caller must hold subscription row lock. Invoice and cursor commit together."""
    today = today or date.today()
    invoices = []
    while (sub.status == "active" and sub.next_billing_date <= today
           and (not sub.expiry_date or sub.next_billing_date <= sub.expiry_date)
           and len(invoices) < max_cycles):
        invoices.append(create_invoice(db, sub, actor))
    return invoices
