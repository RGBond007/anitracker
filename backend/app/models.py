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


class Mood(enum.StrEnum):
    """
    A short reaction to one episode, from a closed set.

    Fixed words rather than free text for the same reason completion reactions are:
    a mood is a glance, and an open field invites the review nobody asked for. The
    note beside it is where anything longer goes.
    """

    loved = "loved"
    moved = "moved"
    tense = "tense"
    funny = "funny"
    lost = "lost"
    dull = "dull"


class WatchGroupState(enum.StrEnum):
    """Where one person stands with one group."""

    invited = "invited"
    joined = "joined"
    left = "left"


class Reaction(enum.StrEnum):
    """
    The fixed vocabulary of a completion reaction.

    A closed set rather than free text, deliberately. An open comment box on someone
    else's finished show is a moderation surface, a spoiler surface and an argument
    surface all at once; five words that all mean "I saw that you finished this" are
    none of those things.
    """

    clapped = "clapped"
    same = "same"
    queued = "queued"
    envious = "envious"
    crying = "crying"


class RecommendationState(enum.StrEnum):
    pending = "pending"
    viewed = "viewed"
    accepted = "accepted"
    dismissed = "dismissed"


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
    #: Hold back what the viewer has not reached yet, and make revealing it an
    #: explicit act. Defaults to *on*: the cost of protection nobody wanted is one
    #: extra tap, and the cost of missing protection somebody wanted is the story.
    spoiler_protection: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # Set when an admin creates the account with a one-time password. While true the
    # API serves nothing but /me and the password change, so the temporary secret
    # cannot be used to actually operate the account.
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    # The uploaded profile picture, as the bare filename `app.avatars` generated for
    # it -- never a path and never anything the user chose, so nothing that reaches
    # the filesystem came from a request. NULL is the normal state: an account that
    # has not uploaded one draws its initials instead.
    avatar_filename: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    entries: Mapped[list["ListEntry"]] = relationship(back_populates="user")

    @property
    def avatar_url(self) -> str | None:
        """
        Where the picture is served from, or None.

        Built here rather than in each schema so there is one answer, and read
        straight off the model by `from_attributes`. Every upload gets a new random
        filename, so this URL changes whenever the picture does and a replacement
        appears immediately instead of behind a stale cache entry.
        """
        return f"/media/avatars/{self.avatar_filename}" if self.avatar_filename else None


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
    #: Per-episode titles in order, when the provider has any. Empty is the normal
    #: case, not a failure: AniList only carries these where a streaming site
    #: supplied them, and Jikan and Kitsu do not return them at all. The UI shows
    #: a numbered episode either way and adds the title when there is one.
    episode_titles: Mapped[list[str]] = mapped_column(StringArray, default=list)
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


class FriendRecommendation(Base):
    """
    One friend handing another a title, with a line about why.

    Named `FriendRecommendation` rather than `Recommendation` because the app
    already has one of those: `schemas.Recommendation` is the *computed* kind, a
    title inferred from what friends scored highly. This is the opposite -- nothing
    is inferred, someone chose it and said so -- and letting the two share a name
    would make every import a question.

    It stores the provider coordinates rather than a `media_cache_id` because the
    sender's instance may hold a title the recipient's library has never cached;
    resolution happens when they accept, through the same path adding any title
    takes. That also keeps this table out of the way of cache eviction.

    Privacy is not a column. A recommendation is readable by exactly two accounts,
    and access is checked against the *current* friendship every time it is read --
    so unfriending someone takes their recommendations away in both directions
    without touching a row. Storing a "was a friend then" snapshot would be the
    wrong answer to the question the reader is actually asking.
    """

    __tablename__ = "friend_recommendations"
    __table_args__ = (
        CheckConstraint("sender_id <> recipient_id", name="ck_recommendation_not_self"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32))
    provider_id: Mapped[str] = mapped_column(String(64), index=True)
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType, name="media_type"))
    #: Capped in the schema as well; the column is the backstop, not the rule.
    message: Mapped[str | None] = mapped_column(String(280))
    #: The sender's own declaration about their message. Believed when it says
    #: "yes" and never trusted alone when it says "no" -- the reader's own progress
    #: decides that, because people are wrong about what spoils things.
    has_spoilers: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    state: Mapped[RecommendationState] = mapped_column(
        Enum(RecommendationState, name="recommendation_state"),
        default=RecommendationState.pending,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    sender: Mapped[User] = relationship(foreign_keys=[sender_id])
    recipient: Mapped[User] = relationship(foreign_keys=[recipient_id])


class JournalEntry(Base):
    """
    One person's note about one episode.

    Separate from `ListEntry.notes` on purpose. That field is a single scratchpad
    for a whole title -- "watching with Kaito", "dubbed version" -- and overwriting
    it every episode would destroy the thing it is for. A journal is a series of
    dated moments, and the two answer different questions.

    **Private, with no way to share it.** There is no visibility column and no
    endpoint that returns one of these to anyone but its author. That is deliberate
    rather than unfinished: the brief that asked for this also asked that it not
    become a review platform, and the surest way to keep that promise is to give
    the data nowhere else to go. Sharing would be a later decision, made once,
    rather than a flag that quietly defaults wrong.

    `rewatch_index` is what makes a rewatch its own memory instead of an edit: the
    row is keyed by the pass you were on, so watching episode 7 again writes a
    second entry beside the first rather than over it.
    """

    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint(
            "list_entry_id", "unit", "rewatch_index", name="uq_journal_entry_unit_pass"
        ),
        CheckConstraint("unit >= 1", name="ck_journal_unit_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    list_entry_id: Mapped[int] = mapped_column(
        ForeignKey("list_entries.id", ondelete="CASCADE"), index=True
    )
    #: Episode or chapter number. Which of the two is read from the title's type.
    unit: Mapped[int] = mapped_column(Integer)
    #: Which pass through the title this belongs to. 0 is the first watch.
    rewatch_index: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str | None] = mapped_column(String(1000))
    mood: Mapped[Mood | None] = mapped_column(Enum(Mood, name="mood"))
    #: "This is the one." At most a handful per title, and never a score.
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    #: Covered on the reader's own timeline too -- a journal is often reread years
    #: later, next to titles they have since forgotten the shape of.
    has_spoilers: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    entry: Mapped[ListEntry] = relationship()


class WatchGroup(Base):
    """
    A few friends agreeing to watch one title at roughly the same pace.

    Coordination, not playback: the group holds a title, a roster, and optionally
    the episode everyone is aiming at next. Nothing here streams, syncs or plays
    anything, and the app never learns whether a session actually happened.

    Scoped to a title rather than to a shelf. A shared shelf would need permissions
    on a collection that changes under you; a group is one show, one roster, and it
    ends when the show does.

    Progress is *not* stored here. Each member's position is read from their own
    `ListEntry` at request time, so a group can never disagree with the library and
    leaving a group takes nothing with it.
    """

    __tablename__ = "watch_groups"
    __table_args__ = (
        UniqueConstraint(
            "owner_id", "provider", "provider_id", "closed_at", name="uq_group_owner_title_open"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(32))
    provider_id: Mapped[str] = mapped_column(String(64), index=True)
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType, name="media_type"))
    #: The episode the group is aiming at next. Null until somebody proposes one.
    target_unit: Mapped[int | None] = mapped_column(Integer)
    #: Set when the owner closes it. Kept rather than deleted so members who were
    #: in it are not surprised by a row vanishing mid-request.
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped[User] = relationship()
    members: Mapped[list["WatchGroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class WatchGroupMember(Base):
    """
    One person's standing in one group.

    `left` is a state rather than a deleted row: it stops a closed invitation from
    being re-sent as though it were new, and it means "was in this" is answerable
    without keeping a separate log.
    """

    __tablename__ = "watch_group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_group_member"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("watch_groups.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    state: Mapped[WatchGroupState] = mapped_column(
        Enum(WatchGroupState, name="watch_group_state"), default=WatchGroupState.invited, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    group: Mapped[WatchGroup] = relationship(back_populates="members")
    user: Mapped[User] = relationship()


class EntryReaction(Base):
    """
    One friend's reaction to another finishing something.

    Points at the *entry* rather than the title, because the thing being reacted to
    is the event -- "you finished this" -- and not the show. One reaction per person
    per entry: this is an acknowledgement, not a tally, and letting someone stack
    five of them would turn it into a score.

    There is no reaction count on a profile and no ranking anywhere. The feature is
    a small social moment, and the moment it becomes a number people compete on it
    has become the thing this app is explicitly not.
    """

    __tablename__ = "entry_reactions"
    __table_args__ = (UniqueConstraint("entry_id", "user_id", name="uq_reaction_entry_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(
        ForeignKey("list_entries.id", ondelete="CASCADE"), index=True
    )
    #: Who reacted. Cascades, so a deleted account takes its reactions with it.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[Reaction] = mapped_column(Enum(Reaction, name="reaction"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    entry: Mapped[ListEntry] = relationship()
    user: Mapped[User] = relationship()


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


class Shelf(Base):
    """
    A named collection of entries, kept deliberately independent of status.

    Status answers "where am I with this" and has exactly one value; a shelf answers
    "what kind of thing is this to me" and has as many as the user likes. Keeping
    them apart is the whole point: a title finished two years ago still belongs on
    "Comfort shows", and putting that on the status enum would mean choosing between
    the two facts.

    There are no built-in shelves. "Favorites" and the rest are names the client
    offers when someone creates one, not rows seeded into every account -- a shelf
    nobody asked for is a shelf nobody curates, and an empty "Best soundtracks" on
    a fresh install says the app expects something of you.

    Ordering is explicit rather than by date added: a shelf is a running order the
    owner arranges, which is what separates it from a filter over the list.
    """

    __tablename__ = "shelves"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_shelf_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(String(280))
    #: Where the shelf sits among the user's own shelves, ascending.
    position: Mapped[int] = mapped_column(Integer, default=0)
    #: Visible on the owner's profile to people who may see their list. Defaults to
    #: false and every existing shelf keeps that: a shelf is private working space
    #: until its owner says otherwise, and no upgrade may publish one for them.
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["ShelfItem"]] = relationship(
        back_populates="shelf",
        cascade="all, delete-orphan",
        order_by="ShelfItem.position",
    )


class ShelfItem(Base):
    """
    One entry's place on one shelf.

    It points at a `ListEntry` rather than at a `MediaCache` row so a shelf can only
    ever hold things the user actually tracks, and so removing a title from the
    library takes it off every shelf by cascade instead of leaving a dangling name.
    """

    __tablename__ = "shelf_items"
    __table_args__ = (UniqueConstraint("shelf_id", "list_entry_id", name="uq_shelf_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    shelf_id: Mapped[int] = mapped_column(ForeignKey("shelves.id", ondelete="CASCADE"), index=True)
    list_entry_id: Mapped[int] = mapped_column(
        ForeignKey("list_entries.id", ondelete="CASCADE"), index=True
    )
    #: Position within the shelf, ascending. Gaps are fine; the API rewrites the
    #: whole run on reorder rather than trying to shuffle neighbours.
    position: Mapped[int] = mapped_column(Integer, default=0)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    shelf: Mapped[Shelf] = relationship(back_populates="items")
    entry: Mapped[ListEntry] = relationship()


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
