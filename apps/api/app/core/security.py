import hashlib
import re
import secrets
import string
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()
_settings = get_settings()

ACCESS = "access"
PASSWORD_CHANGE = "pwd_change"


def now() -> datetime:
    return datetime.now(UTC)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


# A real hash, verified against when no user matches, so response time does not reveal
# whether an email exists.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))

_PASSWORD_RULE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,128}$")


def check_password_policy(password: str) -> None:
    if not _PASSWORD_RULE.match(password):
        raise ValueError("password must be 8 to 128 characters with at least one letter and digit")


def generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(length))
        if any(c.isdigit() for c in pw) and any(c.isalpha() for c in pw):
            return pw


def new_opaque_token() -> tuple[str, str]:
    """Return (secret for the user, SHA-256 hash for the database)."""
    secret = secrets.token_urlsafe(32)
    return secret, hash_token(secret)


def hash_token(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def create_jwt(user_id: UUID, tenant_id: UUID | None, kind: str, minutes: int, **extra: Any) -> str:
    issued = now()
    payload = {
        "sub": str(user_id),
        "tid": str(tenant_id) if tenant_id else None,
        "typ": kind,
        "iat": issued,
        "exp": issued + timedelta(minutes=minutes),
        **extra,
    }
    return jwt.encode(payload, _settings.jwt_secret, algorithm=_settings.jwt_algorithm)


def decode_jwt(token: str, expected_kind: str) -> dict[str, Any]:
    """Raise jwt.InvalidTokenError if the token is invalid, expired or of the wrong kind."""
    payload = jwt.decode(token, _settings.jwt_secret, algorithms=[_settings.jwt_algorithm])
    if payload.get("typ") != expected_kind:
        raise jwt.InvalidTokenError("wrong token type")
    return payload
