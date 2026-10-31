from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator, field_validator

Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]
Name = Annotated[str, Field(min_length=1, max_length=200)]
ID = Annotated[str, Field(min_length=1, max_length=36)]
Quantity = Annotated[int, Field(gt=0, le=1000000)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def validate_password(value):
    if not (9 <= len(value) <= 128 and any(c.isupper() for c in value)
            and any(c.islower() for c in value) and any(not c.isalnum() and not c.isspace() for c in value)):
        raise ValueError("Password needs 9–128 characters, uppercase, lowercase and a special character")
    return value


class Register(Input):
    email: EmailStr
    password: str
    business_name: str = Field(default="", max_length=200)
    billing_address: str = Field(default="", max_length=3000)
    tax_number: str = Field(default="", max_length=100)
    _password = field_validator("password")(validate_password)


class Login(Input):
    email: EmailStr
    password: str


class ForgotPassword(Input):
    email: EmailStr


class ResetPassword(Input):
    token: str = Field(min_length=20, max_length=200)
    password: str
    _password = field_validator("password")(validate_password)


class UserUpdate(Input):
    role: Literal["admin", "staff", "customer"] | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def no_null(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("User fields cannot be null")
        return self


class ProductInput(Input):
    name: Name
    type: Literal["service", "consumable", "goods"] = "service"
    sales_price: Money
    cost_price: Money = Decimal("0")
    notes: str = Field(default="", max_length=5000)
    is_active: bool = True


class VariantInput(Input):
    attribute_name: Annotated[str, Field(min_length=1, max_length=100)]
    attribute_value: Annotated[str, Field(min_length=1, max_length=100)]
    price_extra: Money = Decimal("0")


class PlanProductInput(Input):
    product_id: ID
    default_quantity: Quantity = 1


class PlanInput(Input):
    name: Name
    price: Money
    billing_interval: Literal["daily", "weekly", "monthly", "yearly"]
    minimum_quantity: Quantity = 1
    available_from: date | None = None
    available_until: date | None = None
    auto_close: bool = True
    allow_pause: bool = True
    allow_early_close: bool = False
    allow_renewal: bool = True
    is_active: bool = True
    products: list[PlanProductInput] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def dates(self):
        if self.available_from and self.available_until and self.available_until < self.available_from:
            raise ValueError("available_until precedes available_from")
        if len({p.product_id for p in self.products}) != len(self.products):
            raise ValueError("Duplicate plan products")
        return self


class TaxInput(Input):
    name: Name
    rate: Annotated[Decimal, Field(ge=0, le=100, max_digits=7, decimal_places=4)]
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date precedes start_date")
        return self


class DiscountInput(TaxInput):
    rate: None = Field(default=None, exclude=True)
    type: Literal["fixed", "percentage"]
    value: Money
    min_purchase: Money = Decimal("0")
    min_quantity: Quantity = 1
    usage_limit: Annotated[int, Field(gt=0)] | None = None
    product_id: ID | None = None
    subscription_id: ID | None = None

    @model_validator(mode="after")
    def percentage(self):
        if self.type == "percentage" and self.value > 100:
            raise ValueError("Percentage cannot exceed 100")
        return self


class LineInput(Input):
    product_id: ID
    variant_id: ID | None = None
    quantity: Quantity = 1
    unit_price: Money | None = None
    tax_rule_id: ID | None = None


class TemplateInput(Input):
    name: Name
    plan_id: ID
    validity_days: Annotated[int, Field(gt=0, le=365)] = 30
    lines: list[LineInput] = Field(default_factory=list, max_length=100)


class SubscriptionInput(Input):
    customer_id: ID
    plan_id: ID
    start_date: date
    expiry_date: date | None = None
    payment_terms: Annotated[int, Field(ge=0, le=365)] = 14
    lines: list[LineInput] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def dates(self):
        if self.expiry_date and self.expiry_date < self.start_date:
            raise ValueError("expiry_date precedes start_date")
        return self


class FromTemplate(Input):
    template_id: ID
    customer_id: ID
    start_date: date
    expiry_date: date | None = None
    payment_terms: Annotated[int, Field(ge=0, le=365)] = 14


class Renew(Input):
    expiry_date: date


class AssignDiscount(Input):
    discount_id: ID


class PaymentInput(Input):
    amount: PositiveMoney
    method: Literal["cash", "bank_transfer", "card", "upi", "cheque", "other"]
    payment_date: date = Field(default_factory=date.today)
    notes: str = Field(default="", max_length=3000)
    idempotency_key: str = Field(min_length=8, max_length=100)

    @model_validator(mode="after")
    def date_not_future(self):
        if self.payment_date > date.today():
            raise ValueError("Payment date cannot be in the future")
        return self


class ReversalInput(Input):
    reason: str = Field(min_length=3, max_length=3000)
