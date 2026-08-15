"""Resolves instance configuration from the database, falling back to the environment.

Branding and the registration toggle are settable two ways -- `.env` for the operator
who deploys, and Settings for the admin who runs the instance day to day. The DB wins
when it has an opinion; a NULL column means "whatever `.env` says".
"""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as env
from app.models import InstanceSettings

SETTINGS_ID = 1


@dataclass(frozen=True, slots=True)
class ResolvedInstance:
    instance_name: str
    logo_url: str
    accent_color: str
    allow_signup: bool


async def _row(db: AsyncSession) -> InstanceSettings | None:
    return await db.get(InstanceSettings, SETTINGS_ID)


async def resolve(db: AsyncSession) -> ResolvedInstance:
    row = await _row(db)
    return ResolvedInstance(
        instance_name=(row.instance_name if row and row.instance_name else env.instance_name),
        logo_url=(row.logo_url if row and row.logo_url is not None else env.logo_url),
        accent_color=(row.accent_color if row and row.accent_color else env.accent_color),
        allow_signup=(
            row.allow_signup if row and row.allow_signup is not None else env.allow_signup
        ),
    )


async def update(db: AsyncSession, changes: dict) -> ResolvedInstance:
    """Apply admin edits. Passing an empty string clears an override back to the env default."""
    row = await _row(db)
    if row is None:
        row = InstanceSettings(id=SETTINGS_ID)
        db.add(row)

    for key, value in changes.items():
        if key in {"instance_name", "logo_url", "accent_color"} and value == "":
            value = None
        setattr(row, key, value)

    await db.commit()
    return await resolve(db)
