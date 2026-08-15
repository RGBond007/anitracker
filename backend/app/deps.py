from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Role, User
from app.providers.registry import ProviderRegistry
from app.security import ACCESS_COOKIE, decode_token

DbSession = Annotated[AsyncSession, Depends(get_db)]


def get_registry(request: Request) -> ProviderRegistry:
    return request.app.state.registry


Registry = Annotated[ProviderRegistry, Depends(get_registry)]


def _bearer_or_cookie(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(ACCESS_COOKIE)


async def current_user(request: Request, db: DbSession) -> User:
    token = _bearer_or_cookie(request)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_token(token, "access")
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = await db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if payload.get("tv") != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session revoked")
    # Lets a per-account rate limit bucket by user rather than address, so people
    # sharing a household IP do not consume each other's budget.
    request.state.user_id = user.id
    return user


#: An authenticated caller who may still owe a password change. Only the two
#: endpoints that let them settle that debt should accept this.
PendingUser = Annotated[User, Depends(current_user)]


async def settled_user(user: PendingUser) -> User:
    """
    Rejects an account that is still on its one-time password.

    This is what `CurrentUser` resolves to, so every route in the app inherits the
    gate by default and a new endpoint cannot forget it. Enforcing it here rather
    than in the UI means a temporary password is useless against the API directly.
    """
    if user.must_change_password:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Set a new password before using this account",
        )
    return user


CurrentUser = Annotated[User, Depends(settled_user)]


async def admin_user(user: CurrentUser) -> User:
    if user.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


AdminUser = Annotated[User, Depends(admin_user)]


async def user_count(db: AsyncSession) -> int:
    return (await db.execute(select(func.count(User.id)))).scalar_one()
