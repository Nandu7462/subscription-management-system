import os
os.environ["SECRET_KEY"] = "test-secret-key-which-is-at-least-32-characters"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["ENVIRONMENT"] = "development"

import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models import User, Customer
from app.core.security import password_hasher, access_token
from app.core.rate_limit import _attempts

PASSWORD = "GoodPassword!9"
HASH = password_hasher.hash(PASSWORD)


def pytest_addoption(parser):
    parser.addoption("--postgres", action="store_true", help="Run against PostgreSQL configured in backend/.env")


@pytest.fixture
def env(tmp_path, monkeypatch, request):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "mail_directory", str(tmp_path / "mail"))
    pg_admin = None
    schema = "test_" + uuid4().hex
    if request.config.getoption("--postgres"):
        from dotenv import dotenv_values
        from sqlalchemy import text
        url = dotenv_values(".env").get("DATABASE_URL", "")
        if not url.startswith("postgresql"):
            pytest.fail("--postgres requires PostgreSQL DATABASE_URL in backend/.env")
        pg_admin = create_engine(url)
        with pg_admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        @event.listens_for(engine, "connect")
        def fk(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory.begin() as db:
        admin = User(email="admin@example.com", role="admin", password_hash=HASH)
        staff = User(email="staff@example.com", role="staff", password_hash=HASH)
        customer = User(email="customer@example.com", role="customer", password_hash=HASH)
        outsider = User(email="outsider@example.com", role="customer", password_hash=HASH)
        db.add_all([admin, staff, customer, outsider])
        db.flush()
        profile = Customer(user_id=customer.id, business_name="Test Business")
        db.add_all([profile, Customer(user_id=outsider.id)])
        db.flush()
        headers = {name: {"Authorization": "Bearer " + access_token(user)} for name, user in
                   [("admin", admin), ("staff", staff), ("customer", customer), ("outsider", outsider)]}
        customer_id = profile.id
    def override_db():
        with factory() as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise
    app.dependency_overrides[get_db] = override_db
    _attempts.clear()
    with TestClient(app) as client:
        yield client, factory, headers, customer_id
    app.dependency_overrides.clear()
    engine.dispose()
    if pg_admin:
        # Only the randomly generated test schema is removed; application data is untouched.
        assert schema.startswith("test_") and len(schema) == 37
        with pg_admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        pg_admin.dispose()


def request_ok(client, method, path, headers, data=None, expected=200):
    response = client.request(method, "/api/v1" + path, headers=headers, json=data)
    assert response.status_code == expected, response.text
    return response.json()


def subscription(env, start=None, interval="monthly", price="0", lines=True, plan_options=None):
    from datetime import date
    client, factory, headers, customer = env
    admin = headers["admin"]
    product = request_ok(client, "POST", "/products", admin,
                         {"name": "Seat", "sales_price": "1000"}, 201)
    plan_data = {"name": "Business", "price": price, "billing_interval": interval, "allow_early_close": True}
    plan_data.update(plan_options or {})
    plan = request_ok(client, "POST", "/plans", admin, plan_data, 201)
    data = {"customer_id": customer, "plan_id": plan["id"], "start_date": (start or date.today()).isoformat()}
    if lines:
        data["lines"] = [{"product_id": product["id"], "quantity": 2}]
    sub = request_ok(client, "POST", "/subscriptions", admin, data, 201)
    return sub, plan, product


def activate(env, sub):
    client, _, headers, _ = env
    for action in ("quote", "confirm", "activate"):
        sub = request_ok(client, "POST", f"/subscriptions/{sub['id']}/{action}", headers["admin"])
    return sub
