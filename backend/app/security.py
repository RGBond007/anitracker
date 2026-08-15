from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

from app.config import settings

_hasher = PasswordHasher()

ALGORITHM = "HS256"
ACCESS_COOKIE = "anitrack_access"
REFRESH_COOKIE = "anitrack_refresh"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _hasher.verify(password_hash, password)
        return True
    except (VerifyMismatchError, VerificationError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def _encode(sub: int, kind: Literal["access", "refresh"], ttl: timedelta, tv: int) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(sub),
        "kind": kind,
        "tv": tv,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_access_token(user_id: int, token_version: int) -> str:
    return _encode(
        user_id, "access", timedelta(minutes=settings.access_token_minutes), token_version
    )


def create_refresh_token(user_id: int, token_version: int) -> str:
    return _encode(user_id, "refresh", timedelta(days=settings.refresh_token_days), token_version)


def decode_token(token: str, expected_kind: Literal["access", "refresh"]) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("kind") != expected_kind:
        return None
    return payload
