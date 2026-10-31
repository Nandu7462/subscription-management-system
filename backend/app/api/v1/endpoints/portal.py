from fastapi import APIRouter
from app.api.v1.endpoints import subscriptions, invoices

# Reuse the same authenticated, ownership-checked handlers for portal URLs.
router = APIRouter(prefix="/portal", tags=["Customer portal"])
for path, handler, method in [
    ("/subscriptions", subscriptions.listing, "GET"),
    ("/subscriptions/{ident}", subscriptions.detail, "GET"),
    ("/invoices", invoices.listing, "GET"),
    ("/invoices/{ident}", invoices.detail, "GET"),
    ("/invoices/{ident}/pdf", invoices.pdf, "GET"),
    ("/subscriptions/{ident}/renew", subscriptions.renew, "POST"),
]:
    router.add_api_route(path, handler, methods=[method], name=f"portal_{handler.__name__}_{path}")
for route in subscriptions.router.routes:
    if route.path.rsplit("/", 1)[-1] in ("pause", "resume", "close"):
        router.add_api_route(route.path, route.endpoint, methods=["POST"], name=f"portal_{route.name}")
