import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.types import StringArray


class Base(DeclarativeBase):
    pass


class Role(enum.StrEnum):
    admin = "admin"
    user = "user"


class MediaType(enum.StrEnum):
    anime = "anime"
    manga = "manga"


class EntryStatus(enum.StrEnum):
    current = "current"  # watching / reading
    completed = "completed"
    on_hold = "on_hold"
    dropped = "dropped"
    planned = "planned"


class TitleLanguage(enum.StrEnum):
    romaji = "romaji"
    english = "english"
    native = "native"


class FriendshipState(enum.StrEnum):
    pending = "pending"
    accepted = "accepted"
    blocked = "blocked"


class ImportState(enum.StrEnum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"), default=Role.user)
    title_language: Mapped[TitleLanguage] = mapped_column(
        Enum(TitleLanguage, name="title_language"), default=TitleLanguage.romaji
    )
    ui_language: Mapped[str] = mapped_column(String(8), default="en")
    theme: Mapped[str] = mapped_column(String(16), default="dark")
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Off by default: a list is visible to accepted friends only until its owner
    # opts in. A self-hosted instance may be reachable from outside the house.
    profile_public: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Set when an admin creates the account with a one-time password. While true the
    # API serves nothing but /me and the password change, so the temporary secret
    # cannot be used to actually operate the account.
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    entries: Mapped[list["ListEntry"]] = relationship(back_populates="user")


class MediaCache(Base):
    __tablename__ = "media_cache"
    __table_args__ = (UniqueConstraint("provider", "provider_id", name="uq_media_provider"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    provider_id: Mapped[str] = mapped_column(String(64), index=True)
    mal_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    type: Mapped[MediaType] = mapped_column(Enum(MediaType, name="media_type"), index=True)

    title_romaji: Mapped[str | None] = mapped_column(String(512))
    title_english: Mapped[str | None] = mapped_column(String(512))
    title_native: Mapped[str | None] = mapped_column(String(512))
    synonyms: Mapped[list[str]] = mapped_column(StringArray, default=list)

    cover_url: Mapped[str | None] = mapped_column(String(1024))
    cover_color: Mapped[str | None] = mapped_column(String(16))
    banner_url: Mapped[str | None] = mapped_column(String(1024))
    synopsis: Mapped[str | None] = mapped_column(Text)

    total_units: Mapped[int | None] = mapped_column(Integer)  # episodes or chapters
    format: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str | None] = mapped_column(String(32))
    season_year: Mapped[int | None] = mapped_column(Integer)
    season: Mapped[str | None] = mapped_column(String(16))

    # --- Season chain -----------------------------------------------------
    # Direct neighbours as provider ids, straight from the provider.
    prequel_id: Mapped[str | None] = mapped_column(String(64))
    sequel_id: Mapped[str | None] = mapped_column(String(64))
    # The series this title is an extra of, if any: a movie added before anything
    # else in its series would otherwise resolve into a series of one and be stuck.
    parent_id: Mapped[str | None] = mapped_column(String(64))
    # The movies, OVAs and specials hanging off this title. Persisted because the
    # chain walk reads rows, not provider records, and re-fetching every member to
    # rediscover its extras would cost a provider call per season.
    related_ids: Mapped[list[str]] = mapped_column(StringArray, default=list)
    # Derived by walking prequels to the first season: every entry in one chain
    # shares `root_provider_id`, which is what the library groups on.
    root_provider_id: Mapped[str | None] = mapped_column(String(64), index=True)
    # 1..n along the spine; NULL for an extra, which has a place in the series but
    # not a season number — a movie between seasons 2 and 3 is not season 2.5.
    season_number: Mapped[int | None] = mapped_column(Integer)
    #: season | movie | ova | special | other — what this title is *within* its series.
    kind: Mapped[str | None] = mapped_column(String(16))
    # First air date. `season_year` is too coarse to order a series by: a season and
    # the movie that follows it six months later share a year.
    start_date: Mapped[date | None] = mapped_column(Date)
    genres: Mapped[list[str]] = mapped_column(StringArray, default=list)
    average_score: Mapped[int | None] = mapped_column(Integer)
    duration: Mapped[int | None] = mapped_column(Integer)  # minutes per episode

    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    entries: Mapped[list["ListEntry"]] = relationship(back_populates="media")
    overrides: Mapped[list["TitleOverride"]] = relationship(
        back_populates="media", cascade="all, delete-orphan"
    )


class ListEntry(Base):
    __tablename__ = "list_entries"
    __table_args__ = (UniqueConstraint("user_id", "media_cache_id", name="uq_entry_user_media"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    media_cache_id: Mapped[int] = mapped_column(
        ForeignKey("media_cache.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[EntryStatus] = mapped_column(Enum(EntryStatus, name="entry_status"), index=True)
    score: Mapped[int | None] = mapped_column(Integer)  # 0-10, null = unscored
    progress: Mapped[int] = mapped_column(Integer, default=0)
    rewatch_count: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[date | None] = mapped_column(Date)
    finish_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="entries")
    media: Mapped[MediaCache] = relationship(back_populates="entries")


class Friendship(Base):
    """
    One row per pair, not two. `requester_id` is whoever sent the invite, which is
    what lets the inbox tell an incoming request from an outgoing one; once the
    state is `accepted` the direction carries no meaning and both users are equal.

    The unique constraint is on the ordered pair, so it cannot stop A→B and B→A
    from both existing. `social.py` closes that by treating a reverse pending row
    as an accept rather than inserting a second row.
    """

    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_pair"),
        CheckConstraint("requester_id <> addressee_id", name="ck_friendship_not_self"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    addressee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    state: Mapped[FriendshipState] = mapped_column(
        Enum(FriendshipState, name="friendship_state"),
        default=FriendshipState.pending,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    requester: Mapped[User] = relationship(foreign_keys=[requester_id])
    addressee: Mapped[User] = relationship(foreign_keys=[addressee_id])


class FranchiseSelection(Base):
    """
    Which season of a series the user considers themselves to be on.

    Without this the app has to *infer* the season — "the one marked watching, else
    the furthest along" — which is a good default but not a choice. Once someone
    picks a season explicitly, that pick wins and survives a status change: you can
    finish season 2 and still have the series sitting on season 2 until you move it.

    Keyed by `root_provider_id` rather than by a media row, so the selection belongs
    to the series and not to whichever season happened to be open at the time.
    """

    __tablename__ = "franchise_selections"
    __table_args__ = (
        UniqueConstraint("user_id", "root_provider_id", name="uq_selection_user_root"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    root_provider_id: Mapped[str] = mapped_column(String(64), index=True)
    media_cache_id: Mapped[int] = mapped_column(
        ForeignKey("media_cache.id", ondelete="CASCADE"), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    media: Mapped[MediaCache] = relationship()


class TitleOverride(Base):
    """v2 hook: per-locale manual title overrides. Table exists from v1."""

    __tablename__ = "title_overrides"
    __table_args__ = (
        UniqueConstraint("media_cache_id", "locale", name="uq_override_media_locale"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    media_cache_id: Mapped[int] = mapped_column(
        ForeignKey("media_cache.id", ondelete="CASCADE"), index=True
    )
    locale: Mapped[str] = mapped_column(String(16))
    custom_title: Mapped[str] = mapped_column(String(512))

    media: Mapped[MediaCache] = relationship(back_populates="overrides")


class InstanceSettings(Base):
    """Single-row table (id=1) holding admin-editable instance config.

    A NULL column means "fall back to the environment variable", so an operator can
    keep managing branding in `.env` and an admin can override it from Settings
    without the two fighting. See app/settings_service.py for the resolution.
    """

    __tablename__ = "instance_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    instance_name: Mapped[str | None] = mapped_column(String(64))
    logo_url: Mapped[str | None] = mapped_column(String(1024))
    accent_color: Mapped[str | None] = mapped_column(String(32))
    allow_signup: Mapped[bool | None] = mapped_column(Boolean)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(32), default="mal_xml")
    state: Mapped[ImportState] = mapped_column(
        Enum(ImportState, name="import_state"), default=ImportState.pending
    )
    total: Mapped[int] = mapped_column(Integer, default=0)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    imported: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
