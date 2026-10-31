from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, catalog, quotations, subscriptions, invoices, payments, reports, portal

router = APIRouter(prefix="/api/v1")
for module in (auth, users, catalog, quotations, subscriptions, invoices, payments, reports, portal):
    router.include_router(module.router)
