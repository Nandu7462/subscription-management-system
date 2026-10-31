from datetime import datetime, timedelta, timezone
import secrets
import logging
import smtplib
from fastapi import HTTPException
from sqlalchemy import select, update
from app.models import User, Customer, PasswordResetToken
from app.core.security import password_hasher, token_hash, DUMMY_HASH, access_token
from app.core.config import get_settings
from app.utils.email import send_email
from app.api.common import audit


def register(db, data, role="customer"):
    email = str(data.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "Email is already registered")
    user = User(email=email, password_hash=password_hasher.hash(data.password), role=role)
    db.add(user)
    db.flush()
    if role == "customer":
        db.add(Customer(user_id=user.id, business_name=data.business_name,
                        billing_address=data.billing_address, tax_number=data.tax_number))
    db.flush()
    return user


def login(db, email, password):
    user = db.scalar(select(User).where(User.email == str(email).lower()))
    valid = password_hasher.verify(password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid or not user.is_active:
        raise HTTPException(401, "Incorrect email or password", headers={"WWW-Authenticate": "Bearer"})
    return {"access_token": access_token(user), "token_type": "bearer"}


def forgot_password(db, email):
    user = db.scalar(select(User).where(User.email == str(email).lower(), User.is_active.is_(True)))
    if user:
        raw = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash(raw),
                                 expires_at=datetime.now(timezone.utc) + timedelta(minutes=30)))
        # Commit token before delivering the email so delivery never exposes an unusable token.
        db.commit()
        try:
            send_email(user.email, "Reset your password",
                       f"Reset your password within 30 minutes: {get_settings().frontend_url}/reset-password?token={raw}")
        except (OSError, smtplib.SMTPException):
            logging.getLogger(__name__).error("Password reset mail delivery failed")
    return {"message": "If the account exists, a password reset email has been sent"}


def reset_password(db, data):
    now = datetime.now(timezone.utc)
    # Atomic claim also prevents concurrent reuse of a reset token.
    claimed = db.execute(update(PasswordResetToken).where(
        PasswordResetToken.token_hash == token_hash(data.token), PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > now).values(used_at=now).returning(PasswordResetToken.user_id)).scalar_one_or_none()
    if not claimed:
        raise HTTPException(400, "Invalid, expired or already used reset token")
    user = db.scalar(select(User).where(User.id == claimed).with_for_update())
    user.password_hash = password_hasher.hash(data.password)
    user.token_version += 1
    db.execute(update(PasswordResetToken).where(PasswordResetToken.user_id == user.id,
               PasswordResetToken.used_at.is_(None)).values(used_at=now))
    audit(db, user, "password.reset", user)
    return {"message": "Password updated"}
