from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.session import get_db
from app.models import User, Customer

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def current_user(token: str = Depends(oauth2), db: Session = Depends(get_db, scope="function")):
    try:
        claims = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"],
                            issuer="subscription-backend", audience="subscription-api",
                            options={"require": ["sub", "ver", "exp", "iat"]})
        user = db.get(User, claims["sub"])
        if not user or not user.is_active or user.token_version != claims["ver"]:
            raise ValueError()
        return user
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise HTTPException(401, "Invalid or expired credentials", headers={"WWW-Authenticate": "Bearer"})


def employee(user: User = Depends(current_user)):
    if user.role not in ("admin", "staff"):
        raise HTTPException(403, "Staff access required")
    return user


def admin(user: User = Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def customer_id(db, user):
    return db.scalar(select(Customer.id).where(Customer.user_id == user.id))


def own(db, user, resource):
    if user.role == "customer" and resource.customer_id != customer_id(db, user):
        raise HTTPException(404, "Resource not found")
    return resource
