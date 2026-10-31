from datetime import datetime, timedelta, timezone
import hashlib
import jwt
from pwdlib import PasswordHash
from app.core.config import get_settings

password_hasher = PasswordHash.recommended()
DUMMY_HASH = password_hasher.hash("Dummy-password!not-used")


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def access_token(user):
    settings = get_settings()
    issued = datetime.now(timezone.utc)
    return jwt.encode({"sub": user.id, "ver": user.token_version, "iat": issued,
                       "exp": issued + timedelta(minutes=settings.access_token_minutes),
                       "iss": "subscription-backend", "aud": "subscription-api"},
                      settings.secret_key, algorithm="HS256")
