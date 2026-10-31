from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import create_model
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from app.core.permissions import admin, employee, current_user
from app.db.session import get_db
from app.models import Product, ProductVariant, Plan, PlanProduct, TaxRule, DiscountRule, Subscription
from app.schemas.inputs import ProductInput, VariantInput, PlanInput, TaxInput, DiscountInput, Input
from app.api.common import get, page, public, audit, update_validated

router = APIRouter(tags=["Catalog"])


def plan_products(db, plan, products):
    for row in products:
        product = get(db, Product, row.product_id)
        if not product.is_active:
            raise HTTPException(409, "Cannot add archived product to plan")
    db.execute(delete(PlanProduct).where(PlanProduct.plan_id == plan.id))
    db.add_all([PlanProduct(plan_id=plan.id, **row.model_dump()) for row in products])


def validate_discount_refs(db, data):
    if data.product_id:
        get(db, Product, data.product_id)
    if data.subscription_id:
        get(db, Subscription, data.subscription_id)


def resource(path, model, schema, read_permission=current_user):
    patch_schema = create_model(f"{model.__name__}Patch", __base__=Input,
        **{key: (field.rebuild_annotation(), None) for key, field in schema.model_fields.items()})

    def create(data: schema, db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
        values = data.model_dump(exclude={"products"})
        if model is DiscountRule:
            validate_discount_refs(db, data)
        item = model(**values)
        db.add(item)
        db.flush()
        if model is Plan:
            plan_products(db, item, data.products)
        audit(db, actor, f"{path}.create", item)
        result = public(item)
        if model is Plan:
            result["products"] = public(db.scalars(select(PlanProduct).where(PlanProduct.plan_id == item.id)).all())
        return result

    def listing(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
                db: Session = Depends(get_db, scope="function"), actor=Depends(read_permission)):
        stmt = select(model).order_by(model.created_at, model.id)
        if actor.role == "customer" and hasattr(model, "is_active"):
            stmt = stmt.where(model.is_active.is_(True))
        return page(db, stmt, offset, limit)

    def detail(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(read_permission)):
        item = get(db, model, ident)
        if actor.role == "customer" and hasattr(item, "is_active") and not item.is_active:
            raise HTTPException(404, "Resource not found")
        result = public(item)
        if model is Plan:
            result["products"] = public(db.scalars(select(PlanProduct).where(PlanProduct.plan_id == item.id)).all())
        return result

    def patch(ident: str, data: patch_schema, db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
        item = get(db, model, ident, lock=True)
        extra = {}
        if model is Plan:
            extra["products"] = [dict(product_id=p.product_id, default_quantity=p.default_quantity) for p in
                                 db.scalars(select(PlanProduct).where(PlanProduct.plan_id == item.id))]
        valid = update_validated(item, data.model_dump(exclude_unset=True), schema, **extra)
        if model is DiscountRule:
            validate_discount_refs(db, valid)
            if valid.usage_limit is not None and valid.usage_limit < item.usage_count:
                raise HTTPException(409, "Usage limit cannot be lower than redemptions already made")
        for key, value in valid.model_dump(exclude={"products"}).items():
            setattr(item, key, value)
        if model is Plan and "products" in data.model_fields_set:
            plan_products(db, item, valid.products)
        audit(db, actor, f"{path}.update", item, fields=list(data.model_fields_set))
        return public(item)

    for method, suffix, endpoint, status in [("POST", "", create, 201), ("GET", "", listing, 200),
                                             ("GET", "/{ident}", detail, 200), ("PATCH", "/{ident}", patch, 200)]:
        router.add_api_route(f"/{path}{suffix}", endpoint, methods=[method], status_code=status,
                             name=f"{method.lower()}_{path}_{'detail' if suffix else 'list'}")


resource("products", Product, ProductInput)
resource("plans", Plan, PlanInput)
resource("taxes", TaxRule, TaxInput, employee)
resource("discounts", DiscountRule, DiscountInput, employee)


@router.delete("/products/{ident}")
def archive_product(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
    item = get(db, Product, ident, lock=True)
    item.is_active = False
    audit(db, actor, "product.archive", item)
    return public(item)


@router.post("/plans/{ident}/archive")
def archive_plan(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
    item = get(db, Plan, ident, lock=True)
    item.is_active = False
    audit(db, actor, "plan.archive", item)
    return public(item)


@router.post("/products/{ident}/variants", status_code=201)
def create_variant(ident: str, data: VariantInput, db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
    get(db, Product, ident)
    variant = ProductVariant(product_id=ident, **data.model_dump())
    db.add(variant)
    db.flush()
    audit(db, actor, "variant.create", variant)
    return public(variant)


@router.get("/products/{ident}/variants")
def variants(ident: str, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
             db: Session = Depends(get_db, scope="function"), actor=Depends(current_user)):
    product = get(db, Product, ident)
    if actor.role == "customer" and not product.is_active:
        raise HTTPException(404, "Product not found")
    return page(db, select(ProductVariant).where(ProductVariant.product_id == ident).order_by(ProductVariant.id), offset, limit)


VariantPatch = create_model("VariantPatch", __base__=Input,
    **{k: (v.rebuild_annotation(), None) for k, v in VariantInput.model_fields.items()})


@router.patch("/variants/{ident}")
def update_variant(ident: str, data: VariantPatch, db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
    item = get(db, ProductVariant, ident, lock=True)
    valid = update_validated(item, data.model_dump(exclude_unset=True), VariantInput)
    for k, v in valid.model_dump().items():
        setattr(item, k, v)
    audit(db, actor, "variant.update", item)
    return public(item)
