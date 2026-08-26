from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import (
    EntryStatus,
    FriendshipState,
    ImportState,
    MediaType,
    Reaction,
    RecommendationState,
    Role,
    TitleLanguage,
    WatchGroupState,
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
    #: On by default. See `User.spoiler_protection`.
    spoiler_protection: bool
    must_change_password: bool
    #: None until one is uploaded; the client draws initials in that case.
    avatar_url: str | None = None
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
    spoiler_protection: bool | None = None


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
    license: str


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
    season: str | None = None
    #: Position in its season chain, and the id every season of the show shares.
    #: Both null until the chain has been resolved, or for a standalone title.
    season_number: int | None = None
    root_provider_id: str | None = None
    #: The provider's own relation edges. Present on search results, where nothing
    #: has been cached and therefore nothing has a resolved chain yet -- they are
    #: what lets the client group seasons of one show without guessing from titles.
    prequel_id: str | None = None
    sequel_id: str | None = None
    parent_id: str | None = None
    related_ids: list[str] = []
    #: The real air date where the provider has one. `season_year` alone puts two
    #: cours of the same year in an arbitrary order.
    start_date: date | None = None
    genres: list[str] = []
    #: Per-episode titles, position `n` being episode `n + 1`. Empty for most
    #: titles and for every manga; an empty string means that one episode has no
    #: known title while its neighbours do.
    episode_titles: list[str] = []
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


class PublicEntryOut(ORM):
    """
    Someone else's entry, as other people are allowed to see it.

    `notes` is the delicate field here. It is where a person writes "the mentor
    dies in 19", so it is both the most interesting thing a friend can read and
    the most dangerous. Two rules keep it survivable, and both are enforced on the
    server rather than left to the client:

    * **Accepted friends only.** Never for a stranger browsing a public profile.
      Opting your list into public view is not opting your notes into it.
    * **Covered when the author is ahead.** `author_ahead` says whether the person
      who wrote the note has seen more of this title than the reader has, which is
      exactly when a note is likely to give something away. The client blurs it and
      makes revealing an explicit act.

    Absent -- not empty -- when either rule fails, so a client cannot render
    something it was never sent.
    """

    id: int
    status: EntryStatus
    score: int | None
    progress: int
    rewatch_count: int
    start_date: date | None
    finish_date: date | None
    #: Only ever populated for an accepted friend. See the class docstring.
    notes: str | None = None
    #: True when the note's author is further into this title than the reader.
    author_ahead: bool = False
    updated_at: datetime
    media: MediaOut


# --- Shelves ---


class ShelfItemOut(ORM):
    entry: EntryOut
    position: int


class ShelfOut(ORM):
    id: int
    name: str
    description: str | None
    position: int
    #: False unless the owner has said otherwise. See `Shelf.is_shared`.
    is_shared: bool = False
    #: Present on the single-shelf endpoint; the index leaves it out and sends
    #: `item_count` instead, so opening the library does not drag every shelf's
    #: entries along with it.
    items: list[ShelfItemOut] | None = None
    #: Membership without the artwork. The index needs to answer "is this title on
    #: this shelf" for the toggle in the entry menu, and sending ids costs a list of
    #: integers where sending `items` would cost every cover on every shelf.
    entry_ids: list[int] = []
    item_count: int = 0
    created_at: datetime
    updated_at: datetime


class ShelfCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=280)


class ShelfUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=280)
    position: int | None = Field(default=None, ge=0)
    is_shared: bool | None = None


class ShelfItemIn(BaseModel):
    entry_id: int


class ShelfReorder(BaseModel):
    """The shelf's whole running order, as entry ids. Anything omitted is removed."""

    entry_ids: list[int] = Field(max_length=1000)


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
    #: A profile picture is as public as the username it belongs to -- it is drawn
    #: beside the name everywhere the name appears.
    avatar_url: str | None = None
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
    entries: list[PublicEntryOut]


class ComparisonRow(BaseModel):
    media: MediaOut
    #: The viewer's own row keeps its notes; the other person's never had them.
    mine: EntryOut | None
    theirs: PublicEntryOut | None


class ComparisonOut(BaseModel):
    user: PublicUser
    shared: list[ComparisonRow]
    only_theirs: list[ComparisonRow]
    # Titles you both scored, used for the "you rate things higher" line.
    both_scored: int
    mean_difference: float | None


class FeedItem(BaseModel):
    user: PublicUser
    entry: PublicEntryOut


class WatchingItem(BaseModel):
    """
    One friend and the thing they are part-way through.

    The entry carries its own media row, so the season number and episode count
    behind "S3 · 7/12" are the season's own rather than the show's.
    """

    user: PublicUser
    entry: PublicEntryOut


class Recommendation(BaseModel):
    """
    A title worth a look, and the evidence for saying so.

    No score is invented and nothing is predicted: `fans` are friends who actually
    rated it highly, and `shared_genres` are the genres it has in common with
    something the viewer already rated highly. The client turns those into the
    sentence it shows, so the reason shown is always the reason used.
    """

    media: MediaOut
    #: Friends who rated it at least 9. Ordered, so the avatar stack is stable.
    fans: list[PublicUser] = []
    #: The best score any friend gave it.
    top_score: int | None = None
    #: Genres it shares with `RecommendationsOut.because`.
    shared_genres: list[str] = []


class RecommendationsOut(BaseModel):
    #: The strongest single pick from friends' ratings, or None when friends have
    #: not rated anything the viewer is missing.
    featured: Recommendation | None = None
    #: What the personal list is reasoning from -- the viewer's own favourite.
    because: MediaOut | None = None
    personal: list[Recommendation] = []


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


# --- Recommendations between friends ---


class FriendRecommendationCreate(BaseModel):
    """
    One title, one or more friends, one optional line.

    The message is capped at 280 characters and stripped: it is a nudge, not a
    review, and the column behind it is sized to match so a client that ignores
    this cannot write something the database will not hold.
    """

    provider: str = Field(min_length=1, max_length=32)
    provider_id: str = Field(min_length=1, max_length=64)
    media_type: MediaType
    recipient_ids: list[int] = Field(min_length=1, max_length=25)
    message: str | None = Field(default=None, max_length=280)
    #: The sender saying their own message gives something away.
    has_spoilers: bool = False


class FriendRecommendationOut(ORM):
    id: int
    #: Who sent it, so the recipient can see the answer to "why am I seeing this".
    sender: PublicUser
    recipient: PublicUser
    provider: str
    provider_id: str
    media_type: MediaType
    message: str | None
    #: What the sender declared.
    has_spoilers: bool = False
    #: Whether the *sender* is further into this title than the reader is. Computed
    #: from both libraries, not claimed by anyone -- this is what lets the message
    #: be treated as risky when someone forgot to tick the box, which is the common
    #: case. The client covers a message when either this or `has_spoilers` is true.
    sender_ahead: bool = False
    state: RecommendationState
    created_at: datetime
    #: The cached title, when the instance happens to hold one. Null is normal --
    #: a friend can recommend something nobody here has looked up yet, and the
    #: client falls back to fetching it from the provider.
    media: MediaOut | None = None


class RecommendationStateIn(BaseModel):
    """Only the recipient moves a recommendation, and only along these edges."""

    state: Literal["viewed", "accepted", "dismissed"]


class SendResult(BaseModel):
    sent: list[FriendRecommendationOut]
    #: Recipients skipped because an identical recommendation is already waiting.
    already_pending: list[int] = []


# --- Watch-together groups ---


class WatchMember(BaseModel):
    """
    One member, and where they are with the title.

    `progress` is the member's own count read from their list at request time. It
    is only ever populated for a *joined* member, and only ever sent to another
    member of the same group -- inside the group people have agreed to share a
    pace; outside it, nobody has agreed to anything.
    """

    user: PublicUser
    state: WatchGroupState
    #: Null for someone who has not accepted yet, or who does not track the title.
    progress: int | None = None
    is_owner: bool = False


class WatchGroupOut(ORM):
    id: int
    provider: str
    provider_id: str
    media_type: MediaType
    target_unit: int | None
    is_closed: bool
    #: The viewer's own standing, so the client knows which controls to offer.
    my_state: WatchGroupState
    i_own_it: bool
    members: list[WatchMember] = []
    #: The cached title when the instance has one; null is normal.
    media: MediaOut | None = None
    created_at: datetime


class WatchGroupCreate(BaseModel):
    provider: str = Field(min_length=1, max_length=32)
    provider_id: str = Field(min_length=1, max_length=64)
    media_type: MediaType
    #: Friends to invite up front. May be empty -- a group of one is a group
    #: waiting for someone, not an error.
    invite_ids: list[int] = Field(default_factory=list, max_length=25)


class WatchInviteIn(BaseModel):
    user_ids: list[int] = Field(min_length=1, max_length=25)


class WatchTargetIn(BaseModel):
    """Null clears the target, which is how a group says "no plan yet"."""

    target_unit: int | None = Field(default=None, ge=1)


class SpoilerCheck(BaseModel):
    """
    What logging one more unit would do to the people you are watching with.

    Answered for a specific prospective position rather than in the abstract, so
    the client can ask "if I watch episode 9, who does that leave behind?" and put
    the real names in front of someone before they press the button.
    """

    #: The position being considered.
    unit: int
    #: Joined members whose own progress is below `unit`.
    behind: list[PublicUser] = []
    #: True when `unit` goes past what the group agreed to watch next.
    past_target: bool = False
    target_unit: int | None = None


# --- Small social moments ---


class FriendOnTitle(BaseModel):
    """
    One friend's relationship with the title being looked at.

    Exactly the three facts a comparison needs — where they are, what they gave it,
    and whether they finished — and nothing that says what happens in it.
    """

    user: PublicUser
    status: EntryStatus
    score: int | None
    progress: int


class TitleFriends(BaseModel):
    friends: list[FriendOnTitle] = []
    #: The viewer's own score, so the client can draw the comparison without a
    #: second request. Null when they have not scored it or do not track it.
    my_score: int | None = None


class ReactionIn(BaseModel):
    kind: Reaction


class ReactionOut(ORM):
    user: PublicUser
    kind: Reaction
    created_at: datetime


class ReactionSummary(BaseModel):
    """Who reacted to a completion, and which of the five they picked."""

    entry_id: int
    reactions: list[ReactionOut] = []
    #: The viewer's own pick, so the control can render as a toggle.
    mine: Reaction | None = None


class ShelfShareIn(BaseModel):
    is_shared: bool


# --- Seasons ---


class SeasonOut(BaseModel):
    """
    One member of a series, with the viewer's own tracking of it if any.

    Called a season because that is what the UI is for, but a member can equally be
    a movie, an OVA or a special — `kind` says which, and only a season carries a
    `season_number`.
    """

    media: MediaOut
    #: 1..n along the spine. Null for a movie, OVA or special: it has a place in the
    #: series but not a season number.
    season_number: int | None
    #: season | movie | ova | special | other
    kind: str
    #: Null when this season is not on the user's list — it can still be shown and
    #: added, which is how a series offers you the next season. A null entry is what
    #: the UI shows as "Not started".
    entry: EntryOut | None
    #: True for the one season the user is on. Exactly one member of a series has
    #: this, and browsing another season does not move it.
    is_current: bool


class SeriesOut(BaseModel):
    root_provider_id: str
    #: Series name, taken from season one and stripped of its "Season N" suffix.
    title: str
    #: Every member, in release order — seasons, then whatever aired next.
    seasons: list[SeasonOut]
    #: The season the user is on. Changed only by an explicit action, never by
    #: opening another season's page.
    current_provider_id: str
    #: True when the current season was chosen by the user rather than inferred.
    is_explicit: bool


class SeasonSelectIn(BaseModel):
    """Set the current season, optionally starting it in the same breath."""

    provider_id: str = Field(min_length=1, max_length=64)
    #: Put the new current season on the list as "watching" if it is not already
    #: tracked. This is what "Start season 4" does, as one atomic change rather than
    #: an add followed by a select that can half-apply.
    start: bool = False
    #: A season to mark completed as part of the same action — the other half of
    #: "you finished season 3, start season 4?".
    complete_provider_id: str | None = Field(default=None, max_length=64)


class SeasonSelectionOut(BaseModel):
    """One saved pick, flat enough for the client to key by series."""

    root_provider_id: str
    provider_id: str
