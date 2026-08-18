from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import func, or_, select

from app import avatars, settings_service
from app.config import settings
from app.deps import CurrentUser, DbSession, PendingUser, user_count
from app.models import Role, TitleLanguage, User
from app.ratelimit import limit as rate_limit
from app.ratelimit import penalise
from app.schemas import (
    InstanceInfo,
    LoginIn,
    PasswordChange,
    RegisterIn,
    SetupIn,
    UserOut,
    UserUpdate,
)
from app.security import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.version import VERSION

router = APIRouter(tags=["auth"])


def _set_cookies(response: Response, user: User) -> None:
    common = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": "lax",
        "path": "/",
    }
    response.set_cookie(
        ACCESS_COOKIE,
        create_access_token(user.id, user.token_version),
        max_age=settings.access_token_minutes * 60,
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        create_refresh_token(user.id, user.token_version),
        max_age=settings.refresh_token_days * 86400,
        **common,
    )


def _clear_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path="/")


async def _find_user(db, identifier: str) -> User | None:
    ident = identifier.strip().lower()
    return (
        (
            await db.execute(
                select(User).where(
                    or_(func.lower(User.email) == ident, func.lower(User.username) == ident)
                )
            )
        )
        .scalars()
        .first()
    )


@router.get("/instance", response_model=InstanceInfo)
async def instance_info(db: DbSession) -> InstanceInfo:
    """Unauthenticated: tells the frontend whether to show the setup wizard or login."""
    from app.license import validate

    count = await user_count(db)
    resolved = await settings_service.resolve(db)
    return InstanceInfo(
        instance_name=resolved.instance_name,
        logo_url=resolved.logo_url,
        accent_color=resolved.accent_color,
        setup_complete=count > 0,
        allow_signup=resolved.allow_signup,
        version=VERSION,
        license_tier=validate().tier,
    )


@router.post(
    "/setup",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[rate_limit("setup", 5, 3600)],
)
async def first_run_setup(payload: SetupIn, response: Response, db: DbSession) -> User:
    """Creates the admin account. Only callable while the instance has zero users."""
    if await user_count(db) > 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "Setup already completed")
    user = User(
        email=payload.email.lower(),
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=Role.admin,
        title_language=payload.title_language,
        ui_language=payload.ui_language,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    branding = {
        k: v
        for k, v in {
            "instance_name": payload.instance_name,
            "accent_color": payload.accent_color,
        }.items()
        if v
    }
    if branding:
        await settings_service.update(db, branding)

    _set_cookies(response, user)
    return user


@router.post(
    "/auth/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[rate_limit("register", 5, 3600)],
)
async def register(payload: RegisterIn, response: Response, db: DbSession) -> User:
    count = await user_count(db)
    if count == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "Run first-run setup first")
    if not (await settings_service.resolve(db)).allow_signup:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registration is closed on this instance")
    if await _find_user(db, payload.email) or await _find_user(db, payload.username):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already taken")

    user = User(
        email=payload.email.lower(),
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=Role.user,
        title_language=TitleLanguage.romaji,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    _set_cookies(response, user)
    return user


# Failures spend an extra hit (see `penalise` below), so a wrong password costs
# twice what a right one does and brute force runs out of budget first.
@router.post("/auth/login", response_model=UserOut, dependencies=[rate_limit("login", 10, 300)])
async def login(payload: LoginIn, request: Request, response: Response, db: DbSession) -> User:
    user = await _find_user(db, payload.identifier)
    if user is None or not verify_password(payload.password, user.password_hash):
        penalise(request, "login")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    _set_cookies(response, user)
    return user


# Generous: every 401 in the SPA triggers exactly one of these.
@router.post("/auth/refresh", response_model=UserOut, dependencies=[rate_limit("refresh", 60, 300)])
async def refresh(request: Request, response: Response, db: DbSession) -> User:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token")
    payload = decode_token(token, "refresh")
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = await db.get(User, int(payload["sub"]))
    if user is None or not user.is_active or payload.get("tv") != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session revoked")
    _set_cookies(response, user)
    return user


@router.post("/me/sessions/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_sessions(user: CurrentUser, response: Response, db: DbSession) -> None:
    """
    Signs out every other device.

    Bumping `token_version` invalidates every token ever issued for this account,
    including the caller's own — so fresh cookies are set in the same response to
    keep the person who asked for it logged in.
    """
    user.token_version += 1
    await db.commit()
    await db.refresh(user)
    _set_cookies(response, user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    _clear_cookies(response)


# `PendingUser`, not `CurrentUser`: an account owing a password change still has
# to be able to read itself, or the UI cannot tell why it is being blocked.
@router.get("/me", response_model=UserOut)
async def me(user: PendingUser) -> User:
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(payload: UserUpdate, user: CurrentUser, db: DbSession) -> User:
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"]:
        data["email"] = data["email"].lower()
        existing = await _find_user(db, data["email"])
        if existing and existing.id != user.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already taken")
    if "username" in data and data["username"]:
        existing = await _find_user(db, data["username"])
        if existing and existing.id != user.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    for key, value in data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.put(
    "/me/avatar",
    response_model=UserOut,
    dependencies=[rate_limit("avatar", 12, 3600, scope="user")],
)
async def upload_avatar(user: CurrentUser, db: DbSession, file: UploadFile = File(...)) -> User:
    """
    Replace your own profile picture. Yours: the route has no user parameter, so
    there is nothing to tamper with -- whose avatar this writes is decided by the
    session, not by the request body.
    """
    # One byte past the limit is enough to know it is over, and stops a
    # multi-gigabyte body from being read into memory to find that out.
    data = await file.read(settings.max_avatar_bytes + 1)
    try:
        filename = avatars.store(data)
    except avatars.AvatarError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    previous = user.avatar_filename
    user.avatar_filename = filename
    await db.commit()
    await db.refresh(user)
    # Only once the row naming the new file is committed. The other order can
    # delete the picture that is still being served if the commit fails.
    avatars.discard(previous)
    return user


@router.delete("/me/avatar", response_model=UserOut)
async def remove_avatar(user: CurrentUser, db: DbSession) -> User:
    previous = user.avatar_filename
    user.avatar_filename = None
    await db.commit()
    await db.refresh(user)
    avatars.discard(previous)
    return user


@router.post(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[rate_limit("password", 5, 900, scope="user")],
)
async def change_password(
    payload: PasswordChange, user: PendingUser, response: Response, db: DbSession
) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1  # invalidate every other session
    # Debt settled: the one-time password is gone and the account is fully usable.
    user.must_change_password = False
    await db.commit()
    await db.refresh(user)
    _set_cookies(response, user)
