from fastapi import APIRouter, Depends, Query
from pydantic import create_model
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import employee
from app.api.common import get, public, page, audit, update_validated
from app.models import QuotationTemplate, QuotationTemplateLine, Plan
from app.schemas.inputs import TemplateInput, Input
from app.services.subscription_service import resolve_line

router = APIRouter(prefix="/quotation-templates", tags=["Quotation templates"])
TemplatePatch = create_model("TemplatePatch", __base__=Input,
    **{k: (v.rebuild_annotation(), None) for k, v in TemplateInput.model_fields.items()})


def set_lines(db, item, lines):
    result = []
    for line in lines:
        values = resolve_line(db, line)
        values.pop("description")
        result.append(QuotationTemplateLine(**values))
    item.lines = result


@router.post("", status_code=201)
def create(data: TemplateInput, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    get(db, Plan, data.plan_id)
    item = QuotationTemplate(**data.model_dump(exclude={"lines"}))
    set_lines(db, item, data.lines)
    db.add(item)
    db.flush()
    audit(db, actor, "template.create", item)
    return public(item)


@router.get("")
def listing(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
            db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    return page(db, select(QuotationTemplate).order_by(QuotationTemplate.created_at, QuotationTemplate.id), offset, limit)


@router.get("/{ident}")
def detail(ident: str, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    return public(get(db, QuotationTemplate, ident))


@router.patch("/{ident}")
def patch(ident: str, data: TemplatePatch, db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    item = get(db, QuotationTemplate, ident, lock=True)
    old_lines = [dict(product_id=l.product_id, variant_id=l.variant_id, quantity=l.quantity,
                      unit_price=l.unit_price, tax_rule_id=l.tax_rule_id) for l in item.lines]
    valid = update_validated(item, data.model_dump(exclude_unset=True), TemplateInput, lines=old_lines)
    get(db, Plan, valid.plan_id)
    for k, v in valid.model_dump(exclude={"lines"}).items():
        setattr(item, k, v)
    if "lines" in data.model_fields_set:
        set_lines(db, item, valid.lines)
    audit(db, actor, "template.update", item)
    return public(item)
