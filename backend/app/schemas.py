from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import (
    EntryStatus,
    FriendshipState,
    ImportState,
    MediaType,
    Role,
    TitleLanguage,
)


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth / users ---


class UserOut(ORM):
    id: int
    email: str
    username: str
    role: Role
    title_language: TitleLanguage
    ui_language: str
    theme: str
    profile_public: bool
    must_change_password: bool
    created_at: datetime


class RegisterIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8, max_length=256)


class LoginIn(BaseModel):
    identifier: str  # email or username
    password: str


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=64)
    email: EmailStr | None = None
    title_language: TitleLanguage | None = None
    ui_language: str | None = Field(default=None, max_length=8)
    theme: str | None = Field(default=None, pattern="^(dark|light)$")
    profile_public: bool | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=256)


# --- Instance / setup ---


class InstanceInfo(BaseModel):
    instance_name: str
    logo_url: str
    accent_color: str
    setup_complete: bool
    allow_signup: bool
    version: str
    license_tier: str


class SetupIn(RegisterIn):
    title_language: TitleLanguage = TitleLanguage.romaji
    ui_language: str = "en"
    # Branding chosen in the wizard; omitted values keep the .env defaults.
    instance_name: str | None = Field(default=None, max_length=64)
    accent_color: str | None = Field(default=None, max_length=32)


class InstanceUpdate(BaseModel):
    """Admin-editable instance config. An empty string resets a field to its .env default."""

    instance_name: str | None = Field(default=None, max_length=64)
    logo_url: str | None = Field(default=None, max_length=1024)
    accent_color: str | None = Field(default=None, max_length=32)
    allow_signup: bool | None = None


# --- Media ---


class MediaOut(ORM):
    id: int | None = None
    provider: str
    provider_id: str
    type: MediaType
    mal_id: int | None = None
    title_romaji: str | None = None
    title_english: str | None = None
    title_native: str | None = None
    synonyms: list[str] = []
    cover_url: str | None = None
    cover_color: str | None = None
    banner_url: str | None = None
    synopsis: str | None = None
    total_units: int | None = None
    format: str | None = None
    status: str | None = None
    season_year: int | None = None
    genres: list[str] = []
    average_score: int | None = None
    duration: int | None = None


class SearchResults(BaseModel):
    results: list[MediaOut]
    page: int
    has_more: bool


# --- List entries ---


class EntryBase(BaseModel):
    status: EntryStatus
    score: int | None = Field(default=None, ge=0, le=10)
    progress: int = Field(default=0, ge=0)
    rewatch_count: int = Field(default=0, ge=0)
    start_date: date | None = None
    finish_date: date | None = None
    notes: str | None = Field(default=None, max_length=10_000)


class EntryCreate(EntryBase):
    provider: str = "anilist"
    provider_id: str
    type: MediaType


class EntryUpdate(BaseModel):
    status: EntryStatus | None = None
    score: int | None = Field(default=None, ge=0, le=10)
    progress: int | None = Field(default=None, ge=0)
    rewatch_count: int | None = Field(default=None, ge=0)
    start_date: date | None = None
    finish_date: date | None = None
    notes: str | None = Field(default=None, max_length=10_000)

    @field_validator("score")
    @classmethod
    def _score_range(cls, v: int | None) -> int | None:
        return v


class EntryOut(ORM):
    id: int
    status: EntryStatus
    score: int | None
    progress: int
    rewatch_count: int
    start_date: date | None
    finish_date: date | None
    notes: str | None
    updated_at: datetime
    media: MediaOut


# --- Dashboard ---


class StatusCount(BaseModel):
    status: EntryStatus
    count: int


class TypeStats(BaseModel):
    counts: list[StatusCount]
    total: int
    mean_score: float | None
    scored_count: int
    episodes_watched: int = 0
    chapters_read: int = 0
    days_watched: float = 0.0


class DashboardOut(BaseModel):
    anime: TypeStats
    manga: TypeStats
    in_progress: list[EntryOut]
    recently_updated: list[EntryOut]


# --- Import ---


class ImportJobOut(ORM):
    id: int
    source: str
    state: ImportState
    total: int
    processed: int
    imported: int
    skipped: int
    failed: int
    error: str | None
    created_at: datetime
    updated_at: datetime


# --- Social ---


class PublicUser(ORM):
    """
    What one user is allowed to learn about another. Deliberately not `UserOut`:
    email, role and token state never cross between accounts.
    """

    id: int
    username: str
    profile_public: bool
    created_at: datetime


class FriendSummary(BaseModel):
    """The numbers shown beside a friend's name. Only ever sent for accepted friends."""

    tracked: int
    mean_score: float | None
    #: Titles on both lists — the reason to open their profile.
    in_common: int


class FriendshipOut(BaseModel):
    """A relationship rendered from the point of view of the caller."""

    id: int
    user: PublicUser
    state: FriendshipState
    # "incoming" = they asked you, "outgoing" = you asked them. Meaningless once
    # accepted, but the inbox needs it to decide between Accept and Cancel.
    direction: Literal["incoming", "outgoing"]
    created_at: datetime
    #: Populated for accepted friends only; None on a pending request.
    stats: FriendSummary | None = None


class FriendRequestIn(BaseModel):
    username: str = Field(min_length=2, max_length=64)


class FriendsOut(BaseModel):
    friends: list[FriendshipOut]
    incoming: list[FriendshipOut]
    outgoing: list[FriendshipOut]


class ProfileOut(BaseModel):
    """
    A friend's profile. `entries` is empty and `visible` false when the viewer is
    not allowed to see the list, so the UI can say why instead of 404-ing.
    """

    user: PublicUser
    relationship: Literal["self", "friends", "pending", "none"]
    visible: bool
    anime: TypeStats
    manga: TypeStats
    entries: list[EntryOut]


class ComparisonRow(BaseModel):
    media: MediaOut
    mine: EntryOut | None
    theirs: EntryOut | None


class ComparisonOut(BaseModel):
    user: PublicUser
    shared: list[ComparisonRow]
    only_theirs: list[ComparisonRow]
    # Titles you both scored, used for the "you rate things higher" line.
    both_scored: int
    mean_difference: float | None


class FeedItem(BaseModel):
    user: PublicUser
    entry: EntryOut


class DiscoverUser(BaseModel):
    """
    Someone on the instance you have no link with. `tracked` is None unless they
    made their profile public — the size of a private list is still private.
    """

    user: PublicUser
    tracked: int | None


class LeaderboardRow(BaseModel):
    user: PublicUser
    is_self: bool
    episodes_watched: int
    chapters_read: int
    completed: int
    mean_score: float | None


class LeaderboardOut(BaseModel):
    rows: list[LeaderboardRow]
