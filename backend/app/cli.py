"""Operational commands; no credentials are embedded in source code."""
import argparse
from datetime import date, timedelta
from getpass import getpass
from decimal import Decimal
import json
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models import User, Product, Plan, TaxRule, Customer, Subscription
from app.schemas.inputs import Register, SubscriptionInput
from app.services.auth_service import register
from app.services.subscription_service import create_subscription, transition


def create_admin(email, password=None):
    password = password or getpass("Admin password (9+ characters, upper/lower/special): ")
    data = Register(email=email, password=password)
    with SessionLocal.begin() as db:
        user = register(db, data, "admin")
        print(f"Created administrator {user.email}")


def seed_demo(email, password=None):
    password = password or getpass("Demo customer password: ")
    with SessionLocal.begin() as db:
        admin = db.scalar(select(User).where(User.role == "admin", User.is_active.is_(True)))
        if not admin:
            raise SystemExit("Create an admin before seeding demo data")
        user = register(db, Register(email=email, password=password, business_name="Brightloop Demo"))
        db.flush()
        customer = db.scalar(select(Customer).where(Customer.user_id == user.id))
        product = Product(name="Software seat", sales_price=Decimal("1000"), cost_price=Decimal("100"))
        plan = Plan(name="Business Monthly", price=Decimal("0"), billing_interval="monthly", allow_early_close=True)
        tax = TaxRule(name="Demo tax 18%", rate=Decimal("18"))
        db.add_all([product, plan, tax])
        db.flush()
        data = SubscriptionInput(customer_id=customer.id, plan_id=plan.id, start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365), lines=[dict(product_id=product.id, quantity=2, tax_rule_id=tax.id)])
        sub = create_subscription(db, data, admin)
        for action in ("quote", "confirm", "activate"):
            transition(db, sub, action, admin)
        print(json.dumps({"customer_email": email, "subscription_id": sub.id, "customer_id": customer.id}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["create-admin", "seed-demo"])
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    try:
        (create_admin if args.command == "create-admin" else seed_demo)(args.email)
    except ValueError as exc:
        raise SystemExit(str(exc))
