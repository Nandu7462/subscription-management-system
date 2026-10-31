from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import (Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index,
                        Integer, JSON, Numeric, String, Text, UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc)


class Identity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class User(Identity, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(16), default="customer")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (Index("uq_users_email_lower", func.lower(email), unique=True),
                      CheckConstraint("role IN ('admin','staff','customer')", name="role"))


class Customer(Identity, Base):
    __tablename__ = "customers"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    business_name: Mapped[str] = mapped_column(String(200), default="")
    billing_address: Mapped[str] = mapped_column(Text, default="")
    tax_number: Mapped[str] = mapped_column(String(100), default="")


class PasswordResetToken(Identity, Base):
    __tablename__ = "password_reset_tokens"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Product(Identity, Base):
    __tablename__ = "products"
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(20), default="service")
    sales_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("sales_price >= 0 AND cost_price >= 0", name="prices"),)


class ProductVariant(Identity, Base):
    __tablename__ = "product_variants"
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    attribute_name: Mapped[str] = mapped_column(String(100))
    attribute_value: Mapped[str] = mapped_column(String(100))
    price_extra: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    __table_args__ = (UniqueConstraint("product_id", "attribute_name", "attribute_value"),
                      CheckConstraint("price_extra >= 0", name="extra"))


class Plan(Identity, Base):
    __tablename__ = "plans"
    name: Mapped[str] = mapped_column(String(200))
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    billing_interval: Mapped[str] = mapped_column(String(16))
    minimum_quantity: Mapped[int] = mapped_column(Integer, default=1)
    available_from: Mapped[date | None] = mapped_column(Date)
    available_until: Mapped[date | None] = mapped_column(Date)
    auto_close: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_pause: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_early_close: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_renewal: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("price >= 0 AND minimum_quantity > 0", name="amounts"),
                      CheckConstraint("billing_interval IN ('daily','weekly','monthly','yearly')", name="interval"))


class PlanProduct(Identity, Base):
    __tablename__ = "plan_products"
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    default_quantity: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (UniqueConstraint("plan_id", "product_id"),
                      CheckConstraint("default_quantity > 0", name="quantity"))


class TaxRule(Identity, Base):
    __tablename__ = "tax_rules"
    name: Mapped[str] = mapped_column(String(200))
    rate: Mapped[Decimal] = mapped_column(Numeric(7, 4))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("rate >= 0 AND rate <= 100", name="rate"),)


class DiscountRule(Identity, Base):
    __tablename__ = "discount_rules"
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(16))
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    min_purchase: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    min_quantity: Mapped[int] = mapped_column(Integer, default=1)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    usage_limit: Mapped[int | None] = mapped_column(Integer)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"))
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("subscriptions.id", name="fk_discount_subscription"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("value >= 0 AND min_purchase >= 0 AND min_quantity > 0", name="amounts"),
                      CheckConstraint("type IN ('fixed','percentage') AND (type != 'percentage' OR value <= 100)", name="type_value"),
                      CheckConstraint("usage_count >= 0 AND (usage_limit IS NULL OR usage_count <= usage_limit)", name="usage"))


class QuotationTemplate(Identity, Base):
    __tablename__ = "quotation_templates"
    name: Mapped[str] = mapped_column(String(200))
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"))
    validity_days: Mapped[int] = mapped_column(Integer, default=30)
    lines: Mapped[list["QuotationTemplateLine"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class QuotationTemplateLine(Identity, Base):
    __tablename__ = "quotation_template_lines"
    template_id: Mapped[str] = mapped_column(ForeignKey("quotation_templates.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    variant_id: Mapped[str | None] = mapped_column(ForeignKey("product_variants.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    tax_rule_id: Mapped[str | None] = mapped_column(ForeignKey("tax_rules.id"))


class Subscription(Identity, Base):
    __tablename__ = "subscriptions"
    number: Mapped[str] = mapped_column(String(50), unique=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"))
    status: Mapped[str] = mapped_column(String(20), default="draft")
    start_date: Mapped[date] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    next_billing_date: Mapped[date] = mapped_column(Date)
    billing_anchor: Mapped[date] = mapped_column(Date)
    billing_cycle: Mapped[int] = mapped_column(Integer, default=0)
    billing_interval: Mapped[str] = mapped_column(String(16))
    plan_fee: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    payment_terms: Mapped[int] = mapped_column(Integer, default=14)
    quotation_valid_until: Mapped[date | None] = mapped_column(Date)
    quotation_validity_days: Mapped[int] = mapped_column(Integer, default=30)
    paused_at: Mapped[date | None] = mapped_column(Date)
    lines: Mapped[list["SubscriptionLine"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    __table_args__ = (Index("idx_subscriptions_billing", "status", "next_billing_date"),
                      CheckConstraint("status IN ('draft','quotation','confirmed','active','paused','closed')", name="status"))


class SubscriptionLine(Identity, Base):
    __tablename__ = "subscription_lines"
    subscription_id: Mapped[str] = mapped_column(ForeignKey("subscriptions.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    variant_id: Mapped[str | None] = mapped_column(ForeignKey("product_variants.id"))
    description: Mapped[str] = mapped_column(String(300))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    tax_rule_id: Mapped[str | None] = mapped_column(ForeignKey("tax_rules.id"))
    __table_args__ = (CheckConstraint("quantity > 0 AND unit_price >= 0", name="amounts"),)


class SubscriptionDiscount(Identity, Base):
    __tablename__ = "subscription_discounts"
    subscription_id: Mapped[str] = mapped_column(ForeignKey("subscriptions.id"), index=True)
    discount_id: Mapped[str] = mapped_column(ForeignKey("discount_rules.id"))
    __table_args__ = (UniqueConstraint("subscription_id", "discount_id"),)


class Invoice(Identity, Base):
    __tablename__ = "invoices"
    number: Mapped[str] = mapped_column(String(50), unique=True)
    subscription_id: Mapped[str] = mapped_column(ForeignKey("subscriptions.id"))
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    billing_period: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    tax: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    billing_name: Mapped[str] = mapped_column(String(200))
    billing_address: Mapped[str] = mapped_column(Text)
    tax_number: Mapped[str] = mapped_column(String(100))
    lines: Mapped[list["InvoiceLine"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    __table_args__ = (UniqueConstraint("subscription_id", "billing_period", name="uq_invoice_billing_cycle"),
                      Index("idx_invoices_due", "status", "due_date"),
                      CheckConstraint("total >= 0 AND amount_paid >= 0 AND amount_paid <= total", name="amounts"),
                      CheckConstraint("status IN ('draft','confirmed','partially_paid','paid','cancelled')", name="status"))


class InvoiceLine(Identity, Base):
    __tablename__ = "invoice_lines"
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), index=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"))
    description: Mapped[str] = mapped_column(String(300))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(7, 4), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class DiscountRedemption(Identity, Base):
    __tablename__ = "discount_redemptions"
    discount_id: Mapped[str] = mapped_column(ForeignKey("discount_rules.id"))
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    __table_args__ = (UniqueConstraint("discount_id", "invoice_id"),)


class Payment(Identity, Base):
    __tablename__ = "payments"
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), index=True)
    method: Mapped[str] = mapped_column(String(30))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    payment_date: Mapped[date] = mapped_column(Date, index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    recorded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True)
    reversed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reversal_reason: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (CheckConstraint("amount > 0", name="amount"),)


class AuditLog(Identity, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class BillingJobLog(Identity, Base):
    __tablename__ = "billing_job_logs"
    subscription_id: Mapped[str] = mapped_column(ForeignKey("subscriptions.id"))
    success: Mapped[bool] = mapped_column(Boolean)
    message: Mapped[str] = mapped_column(Text)
