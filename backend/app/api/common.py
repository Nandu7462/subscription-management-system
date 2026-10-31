from datetime import date, datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import inspect, select, func
from app.models import AuditLog


def get(db, model, ident, lock=False):
    stmt = select(model).where(model.id == ident)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    item = db.scalar(stmt)
    if not item:
        raise HTTPException(404, f"{model.__name__} not found")
    return item


def public(item):
    if item is None or isinstance(item, (str, int, bool)):
        return item
    if isinstance(item, Decimal):
        return format(item, ".2f") if item.as_tuple().exponent >= -2 else format(item, "f")
    if isinstance(item, (date, datetime)):
        return item.isoformat()
    if isinstance(item, (list, tuple)):
        return [public(x) for x in item]
    if isinstance(item, dict):
        return {k: public(v) for k, v in item.items()}
    hidden = {"password_hash", "token_version", "token_hash"}
    result = {c.key: public(getattr(item, c.key)) for c in inspect(item).mapper.column_attrs if c.key not in hidden}
    if hasattr(type(item), "lines"):
        result["lines"] = public(item.lines)
    if hasattr(type(item), "amount_paid"):
        result["outstanding_amount"] = public(item.total - item.amount_paid)
    return result


def page(db, statement, offset=0, limit=50):
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    items = db.scalars(statement.offset(offset).limit(limit)).unique().all()
    return {"items": public(items), "total": total, "offset": offset, "limit": limit}


def audit(db, actor, action, entity, **details):
    db.add(AuditLog(actor_id=actor.id if actor else None, action=action,
                    entity_id=entity.id, details=public(details)))


def update_validated(item, changes, schema, **extra):
    from pydantic import ValidationError
    try:
        merged = {key: getattr(item, key) for key in schema.model_fields if hasattr(item, key)}
        merged.update(extra)
        merged.update(changes)
        validated = schema.model_validate(merged)
    except ValidationError as exc:
        raise HTTPException(422, exc.errors(include_context=False, include_input=False))
    return validated
