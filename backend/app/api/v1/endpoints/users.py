from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import admin, employee
from app.models import User, Customer
from app.schemas.inputs import Register, UserUpdate
from app.services.auth_service import register
from app.api.common import public, get, page, audit

router = APIRouter(tags=["Users"])


@router.post("/staff", status_code=201)
def create_staff(data: Register, db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
    user = register(db, data, "staff")
    audit(db, actor, "staff.create", user)
    return public(user)


@router.get("/users")
def users(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
          db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
    return page(db, select(User).order_by(User.created_at, User.id), offset, limit)


@router.patch("/users/{ident}")
def update_user(ident: str, data: UserUpdate, db: Session = Depends(get_db, scope="function"), actor=Depends(admin)):
    # Lock admins in stable order so simultaneous demotions cannot remove the last active admin.
    admins = db.scalars(select(User).where(User.role == "admin", User.is_active.is_(True))
                        .order_by(User.id).with_for_update()).all()
    user = get(db, User, ident, lock=True)
    changes = data.model_dump(exclude_unset=True)
    if user.role == "admin" and user.is_active and len(admins) <= 1 and (
            changes.get("role", user.role) != "admin" or not changes.get("is_active", user.is_active)):
        raise HTTPException(409, "Cannot remove the last active admin")
    for key, value in changes.items():
        setattr(user, key, value)
    user.token_version += 1
    if user.role == "customer" and not db.scalar(select(Customer.id).where(Customer.user_id == user.id)):
        db.add(Customer(user_id=user.id))
    audit(db, actor, "user.update", user, **changes)
    return public(user)


@router.get("/customers")
def customers(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
              db: Session = Depends(get_db, scope="function"), actor=Depends(employee)):
    return page(db, select(Customer).order_by(Customer.created_at, Customer.id), offset, limit)
