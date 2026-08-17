import secrets

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select

from app import settings_service
from app.deps import AdminUser, DbSession
from app.models import Role, User
from app.ratelimit import limit as rate_limit
from app.schemas import InstanceUpdate, UserOut
from app.security import hash_password

#: Long enough that guessing is hopeless, short enough to read down the phone.
#: `token_urlsafe(9)` is 12 characters of base64url, ~71 bits of entropy.
TEMP_PASSWORD_BYTES = 9

router = APIRouter(prefix="/admin", tags=["admin"])


@router.patch("/instance", response_model=settings_service.ResolvedInstance)
async def update_instance(
    payload: InstanceUpdate, admin: AdminUser, db: DbSession
) -> settings_service.ResolvedInstance:
    """Branding and the registration toggle, editable without redeploying."""
    return await settings_service.update(db, payload.model_dump(exclude_unset=True))


class AdminUserUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None


class AdminUserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=64)
    role: Role = Role.user


class CreatedUser(BaseModel):
    """
    The only time the temporary password exists in readable form.

    It is generated, hashed, and returned in this one response — nothing stores or
    logs the clear text, so an admin who loses it has to issue a new one rather
    than look it up.
    """

    user: UserOut
    temporary_password: str


@router.post(
    "/users",
    response_model=CreatedUser,
    status_code=status.HTTP_201_CREATED,
    dependencies=[rate_limit("admin_create_user", 20, 3600, scope="user")],
)
async def create_user(payload: AdminUserCreate, admin: AdminUser, db: DbSession) -> CreatedUser:
    """Creates an account the admin hands over, pending a password change."""
    clash = (
        (
            await db.execute(
                select(User).where(
                    or_(
                        func.lower(User.email) == payload.email.lower(),
                        func.lower(User.username) == payload.username.lower(),
                    )
                )
            )
        )
        .scalars()
        .first()
    )
    if clash is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already taken")

    temporary = secrets.token_urlsafe(TEMP_PASSWORD_BYTES)
    user = User(
        email=payload.email.lower(),
        username=payload.username,
        password_hash=hash_password(temporary),
        role=payload.role,
        must_change_password=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return CreatedUser(user=UserOut.model_validate(user), temporary_password=temporary)


@router.get("/users", response_model=list[UserOut])
async def list_users(admin: AdminUser, db: DbSession) -> list[User]:
    return list((await db.execute(select(User).order_by(User.created_at))).scalars().all())


async def _last_admin(db, user: User) -> bool:
    if user.role != Role.admin:
        return False
    remaining = (
        await db.execute(
            select(func.count(User.id)).where(User.role == Role.admin, User.id != user.id)
        )
    ).scalar_one()
    return remaining == 0


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int, payload: AdminUserUpdate, admin: AdminUser, db: DbSession
) -> User:
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    data = payload.model_dump(exclude_unset=True)
    demoting = data.get("role") == Role.user or data.get("is_active") is False
    if demoting and await _last_admin(db, target):
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot remove the last admin")

    for key, value in data.items():
        setattr(target, key, value)
    if data.get("is_active") is False:
        target.token_version += 1  # kick existing sessions
    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, admin: AdminUser, db: DbSession) -> None:
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if await _last_admin(db, target):
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot delete the last admin")
    await db.delete(target)
    await db.commit()
