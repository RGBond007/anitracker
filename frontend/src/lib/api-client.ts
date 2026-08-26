/**
 * The one place that talks HTTP. Every `features/*` hook goes through this;
 * nothing in `components/ui/*` may import it.
 */

export type MediaType = "anime" | "manga";
export type EntryStatus = "current" | "completed" | "on_hold" | "dropped" | "planned";
export type TitleLanguage = "romaji" | "english" | "native";
export type Role = "admin" | "user";

export interface Media {
  id?: number | null;
  provider: string;
  provider_id: string;
  type: MediaType;
  mal_id?: number | null;
  title_romaji?: string | null;
  title_english?: string | null;
  title_native?: string | null;
  synonyms: string[];
  cover_url?: string | null;
  cover_color?: string | null;
  banner_url?: string | null;
  synopsis?: string | null;
  total_units?: number | null;
  format?: string | null;
  status?: string | null;
  season_year?: number | null;
  season?: string | null;
  /** Position in the show's season chain, and the id every season shares. */
  season_number?: number | null;
  root_provider_id?: string | null;
  /**
   * The provider's relation edges. Present on search results, which are never
   * cached and so have no resolved chain — they are what franchise grouping
   * follows instead of comparing titles.
   */
  prequel_id?: string | null;
  sequel_id?: string | null;
  parent_id?: string | null;
  related_ids?: string[];
  /** ISO date. Orders two cours of the same year, which `season_year` cannot. */
  start_date?: string | null;
  genres: string[];
  /** Position n is episode n+1. Empty for most titles; "" means that one is unknown. */
  episode_titles: string[];
  average_score?: number | null;
  duration?: number | null;
}

export interface Entry {
  id: number;
  status: EntryStatus;
  score: number | null;
  progress: number;
  rewatch_count: number;
  start_date: string | null;
  finish_date: string | null;
  notes: string | null;
  updated_at: string;
  media: Media;
}

/**
 * Someone else's entry, as the server actually sends it on social surfaces.
 *
 * `notes` is absent here because it is absent on the wire: notes are private
 * working text and the one field that can spoil something, so the server strips
 * them from the feed, profiles, comparisons and friends-watching. Typing those as
 * a full `Entry` claimed a field that never arrives.
 */
export type PublicEntry = Omit<Entry, "notes"> & {
  /** Present only for an accepted friend; null otherwise. */
  notes: string | null;
  /**
   * True when the author is further into this title than you are.
   *
   * Optional in the type though the server always sends it, so a component that
   * only reads progress — a poster, a rail — accepts your own `Entry` as well as
   * a friend's without either side pretending to be the other.
   */
  author_ahead?: boolean;
};

/** What a member of a series is. Only a `season` carries a season number. */
export type SeasonKind = "season" | "movie" | "ova" | "special" | "other";

/**
 * One member of a series: its own artwork and episode count, plus the viewer's own
 * progress on it. `entry` is null for a member that exists but is not on the list —
 * which is the state the UI calls "Not started".
 */
export interface Season {
  media: Media;
  /** Null for a movie, OVA or special: it has a place in the series, not a number. */
  season_number: number | null;
  kind: SeasonKind;
  entry: Entry | null;
  /** The one season the user is on. Browsing another season does not move it. */
  is_current: boolean;
}

export interface Series {
  root_provider_id: string;
  /** The show's name, with any "Season N" suffix taken off. */
  title: string;
  /** Every member, in release order. */
  seasons: Season[];
  /** The season the user is on — changed only by an explicit action. */
  current_provider_id: string;
  /** True when the current season was chosen by the user rather than inferred. */
  is_explicit: boolean;
}

/** The one write that moves a user between seasons. */
export interface SetCurrentSeason {
  provider_id: string;
  /** Track it as "watching" too — what "Start season 4" does. */
  start?: boolean;
  /** Mark this season completed in the same transaction. */
  complete_provider_id?: string;
}

/** A saved pick, flat so the library can key it by show. */
export interface SeasonSelection {
  root_provider_id: string;
  provider_id: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  role: Role;
  title_language: TitleLanguage;
  ui_language: string;
  theme: "dark" | "light";
  profile_public: boolean;
  /** On by default: hold back what the reader has not reached yet. */
  spoiler_protection: boolean;
  /** True until an admin-issued one-time password has been replaced. */
  must_change_password: boolean;
  /** Null until a picture is uploaded; the UI draws initials in that case. */
  avatar_url?: string | null;
  created_at: string;
}

export interface Instance {
  instance_name: string;
  logo_url: string;
  accent_color: string;
  setup_complete: boolean;
  allow_signup: boolean;
  version: string;
  license: string;
}

/** Another user, as seen by you. Never carries email or role — the API strips them. */
export interface PublicUser {
  id: number;
  username: string;
  profile_public: boolean;
  /** As public as the username it is drawn beside. Null means initials. */
  avatar_url?: string | null;
  created_at: string;
}

/** One friend and the thing they are part-way through. */
export interface WatchingItem {
  user: PublicUser;
  entry: PublicEntry;
}

/**
 * A title worth a look, and the evidence for it. Nothing here is predicted:
 * `fans` really rated it 9+, and `shared_genres` really are shared with the
 * title the personal list is reasoning from.
 */
export interface Recommendation {
  media: Media;
  fans: PublicUser[];
  top_score?: number | null;
  shared_genres: string[];
}

export interface Recommendations {
  featured?: Recommendation | null;
  /** What the personal list is based on — the viewer's own favourite. */
  because?: Media | null;
  personal: Recommendation[];
}

export type FriendshipState = "pending" | "accepted" | "blocked";

/** Figures shown beside a friend. Absent on a pending request. */
export interface FriendSummary {
  tracked: number;
  mean_score: number | null;
  in_common: number;
}

export interface Friendship {
  id: number;
  user: PublicUser;
  state: FriendshipState;
  stats: FriendSummary | null;
  /** Who asked whom. Only meaningful while pending. */
  direction: "incoming" | "outgoing";
  created_at: string;
}

export interface Friends {
  friends: Friendship[];
  incoming: Friendship[];
  outgoing: Friendship[];
}

export interface Profile {
  user: PublicUser;
  relationship: "self" | "friends" | "pending" | "none";
  /** False when the list is private to you; `entries` and stats are then empty. */
  visible: boolean;
  anime: TypeStats;
  manga: TypeStats;
  entries: PublicEntry[];
}

export interface ComparisonRow {
  media: Media;
  mine: Entry | null;
  theirs: PublicEntry | null;
}

export interface Comparison {
  user: PublicUser;
  shared: ComparisonRow[];
  only_theirs: ComparisonRow[];
  both_scored: number;
  /** Positive means you score things higher than they do. */
  mean_difference: number | null;
}

export interface FeedItem {
  user: PublicUser;
  entry: PublicEntry;
}

export interface AiringEpisode {
  media: Media;
  episode: number;
  airing_at: string;
  /** Your progress, so the strip can flag when you have fallen behind. */
  progress: number;
}

export interface DiscoverUser {
  user: PublicUser;
  /** Null when their profile is private — the size of a hidden list stays hidden. */
  tracked: number | null;
}

export interface LeaderboardRow {
  user: PublicUser;
  is_self: boolean;
  episodes_watched: number;
  chapters_read: number;
  completed: number;
  mean_score: number | null;
}

export interface TypeStats {
  counts: { status: EntryStatus; count: number }[];
  total: number;
  mean_score: number | null;
  scored_count: number;
  episodes_watched: number;
  chapters_read: number;
  days_watched: number;
}

export interface Dashboard {
  anime: TypeStats;
  manga: TypeStats;
  in_progress: Entry[];
  recently_updated: Entry[];
}

/**
 * A named collection, deliberately independent of status: a title finished years
 * ago can still sit on "Comfort shows". `items` is present only on the single-shelf
 * endpoint — the index sends `item_count` instead so opening the library does not
 * pull every shelf's artwork with it.
 */
/**
 * A title one friend handed another, with an optional line about why.
 *
 * Distinct from `Recommendations`, which is the *computed* kind inferred from what
 * friends scored highly. This one was chosen by a person, and `sender` is the
 * answer to "why am I seeing this".
 */
export interface FriendRecommendation {
  id: number;
  sender: PublicUser;
  recipient: PublicUser;
  provider: string;
  provider_id: string;
  media_type: MediaType;
  message: string | null;
  /** What the sender declared about their own message. */
  has_spoilers: boolean;
  /** Computed from both libraries — the reason a label alone is not trusted. */
  sender_ahead: boolean;
  state: "pending" | "viewed" | "accepted" | "dismissed";
  created_at: string;
  /** Null when the instance has never cached the title; the client then fetches it. */
  media: Media | null;
}

export type WatchGroupState = "invited" | "joined" | "left";

export interface WatchMember {
  user: PublicUser;
  state: WatchGroupState;
  /** Only ever present for a joined member, and only to another member. */
  progress: number | null;
  is_owner: boolean;
}

export interface WatchGroup {
  id: number;
  provider: string;
  provider_id: string;
  media_type: MediaType;
  target_unit: number | null;
  is_closed: boolean;
  my_state: WatchGroupState;
  i_own_it: boolean;
  members: WatchMember[];
  media: Media | null;
  created_at: string;
}

/** Who a prospective position would leave behind. Reports; never blocks. */
export interface SpoilerCheck {
  unit: number;
  behind: PublicUser[];
  past_target: boolean;
  target_unit: number | null;
}

export type Reaction = "clapped" | "same" | "queued" | "envious" | "crying";

export interface FriendOnTitle {
  user: PublicUser;
  status: EntryStatus;
  score: number | null;
  progress: number;
}

export interface TitleFriends {
  friends: FriendOnTitle[];
  my_score: number | null;
}

export interface ReactionSummary {
  entry_id: number;
  reactions: { user: PublicUser; kind: Reaction; created_at: string }[];
  mine: Reaction | null;
}

export interface SendRecommendationResult {
  sent: FriendRecommendation[];
  already_pending: number[];
}

export interface Shelf {
  id: number;
  name: string;
  description: string | null;
  position: number;
  /** False unless the owner shared it. Nothing infers this. */
  is_shared: boolean;
  items: ShelfItem[] | null;
  /** Membership without the covers — what the index sends so a toggle can tick. */
  entry_ids: number[];
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface ShelfItem {
  entry: Entry;
  position: number;
}

export interface ImportJob {
  id: number;
  source: string;
  state: "pending" | "running" | "done" | "failed";
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  error: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshing: Promise<boolean> | null = null;

async function rotateSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const isForm = init.body instanceof FormData;
  const requestInit = {
    ...init,
    credentials: "include" as RequestCredentials,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(init.headers ?? {}),
    },
  };
  // The Pages demo uses the same API contract without pretending a static host
  // can run FastAPI. Vite removes this branch from the production bundle.
  const res =
    import.meta.env.VITE_DEMO === "true"
      ? await (await import("../demo/mockApi")).demoRequest(path, requestInit)
      : await fetch(`/api${path}`, requestInit);

  // A 401 on the short-lived access token is the normal path, not an error.
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await rotateSession()) return request<T>(path, init, false);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* error body was not JSON */
    }
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const body = (value: unknown) => JSON.stringify(value);

export const api = {
  instance: () => request<Instance>("/instance"),
  updateInstance: (patch: Record<string, unknown>) =>
    request<Omit<Instance, "setup_complete" | "version" | "license">>("/admin/instance", {
      method: "PATCH",
      body: body(patch),
    }),

  me: () => request<User>("/me"),
  setup: (input: Record<string, unknown>) =>
    request<User>("/setup", { method: "POST", body: body(input) }),
  login: (identifier: string, password: string) =>
    request<User>("/auth/login", { method: "POST", body: body({ identifier, password }) }),
  register: (input: Record<string, unknown>) =>
    request<User>("/auth/register", { method: "POST", body: body(input) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  updateProfile: (patch: Partial<User>) =>
    request<User>("/me", { method: "PATCH", body: body(patch) }),
  /**
   * Replace your own profile picture. No user id: whose avatar this writes is
   * decided by the session, and the server re-encodes whatever is sent.
   */
  uploadAvatar: (file: Blob) => {
    const form = new FormData();
    form.append("file", file, "avatar");
    return request<User>("/me/avatar", { method: "PUT", body: form });
  },
  removeAvatar: () => request<User>("/me/avatar", { method: "DELETE" }),
  revokeSessions: () => request<void>("/me/sessions/revoke", { method: "POST" }),
  changePassword: (current_password: string, new_password: string) =>
    request<void>("/me/password", { method: "POST", body: body({ current_password, new_password }) }),

  search: (q: string, type: MediaType, page = 1, genres: string[] = []) => {
    const params = new URLSearchParams({ q, type, page: String(page) });
    // Narrowed at the source where the provider supports it, so a genre search
    // returns a page of matches rather than a page filtered down to three.
    for (const genre of genres) params.append("genre", genre);
    return request<{ results: Media[]; page: number; has_more: boolean }>(
      `/media/search?${params}`,
    );
  },
  /** What is being watched right now — the search page's resting state. */
  trending: (type: MediaType, limit = 12) =>
    request<Media[]>(`/media/trending?type=${type}&limit=${limit}`),
  media: (provider: string, providerId: string, type: MediaType) =>
    request<Media>(`/media/${provider}/${providerId}?type=${type}`),

  /** Every season of the show this title belongs to, with the viewer's progress. */
  series: (provider: string, providerId: string, type: MediaType) =>
    request<Series>(`/media/${provider}/${providerId}/series?type=${type}`),
  /** Answers with the whole series, so the caller never has to guess the new state. */
  setCurrentSeason: (rootProviderId: string, input: SetCurrentSeason) =>
    request<Series>(`/series/${rootProviderId}/season`, { method: "PUT", body: body(input) }),
  seasonSelections: () => request<SeasonSelection[]>("/series/selections"),

  entries: (params: { type?: MediaType; status?: EntryStatus; sort?: string } = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<Entry[]>(`/entries${qs ? `?${qs}` : ""}`);
  },
  entryForMedia: (provider: string, providerId: string) =>
    request<Entry | null>(`/entries/by-media/${provider}/${providerId}`),
  addEntry: (input: Record<string, unknown>) =>
    request<Entry>("/entries", { method: "POST", body: body(input) }),
  updateEntry: (id: number, patch: Record<string, unknown>) =>
    request<Entry>(`/entries/${id}`, { method: "PATCH", body: body(patch) }),
  incrementEntry: (id: number) => request<Entry>(`/entries/${id}/increment`, { method: "POST" }),
  deleteEntry: (id: number) => request<void>(`/entries/${id}`, { method: "DELETE" }),

  dashboard: () => request<Dashboard>("/dashboard"),

  recommendInbox: () => request<FriendRecommendation[]>("/recommendations/inbox"),
  recommendSent: () => request<FriendRecommendation[]>("/recommendations/sent"),
  recommendSend: (input: {
    provider: string;
    provider_id: string;
    media_type: MediaType;
    recipient_ids: number[];
    message?: string | null;
    has_spoilers?: boolean;
  }) => request<SendRecommendationResult>("/recommendations", { method: "POST", body: body(input) }),
  recommendSetState: (id: number, state: "viewed" | "accepted" | "dismissed") =>
    request<FriendRecommendation>(`/recommendations/${id}`, {
      method: "PATCH",
      body: body({ state }),
    }),
  recommendedBy: (provider: string, providerId: string) =>
    request<PublicUser[]>(`/recommendations/for/${provider}/${encodeURIComponent(providerId)}`),

  watchGroups: () => request<WatchGroup[]>("/watch-groups"),
  watchGroup: (id: number) => request<WatchGroup>(`/watch-groups/${id}`),
  watchGroupForTitle: (provider: string, providerId: string) =>
    request<WatchGroup | null>(`/watch-groups/for/${provider}/${encodeURIComponent(providerId)}`),
  createWatchGroup: (input: {
    provider: string;
    provider_id: string;
    media_type: MediaType;
    invite_ids: number[];
  }) => request<WatchGroup>("/watch-groups", { method: "POST", body: body(input) }),
  joinWatchGroup: (id: number) => request<WatchGroup>(`/watch-groups/${id}/join`, { method: "POST" }),
  leaveWatchGroup: (id: number) =>
    request<void>(`/watch-groups/${id}/leave`, { method: "POST" }),
  closeWatchGroup: (id: number) => request<void>(`/watch-groups/${id}`, { method: "DELETE" }),
  inviteToWatchGroup: (id: number, userIds: number[]) =>
    request<WatchGroup>(`/watch-groups/${id}/invite`, {
      method: "POST",
      body: body({ user_ids: userIds }),
    }),
  setWatchTarget: (id: number, target: number | null) =>
    request<WatchGroup>(`/watch-groups/${id}`, {
      method: "PATCH",
      body: body({ target_unit: target }),
    }),
  watchSpoilerCheck: (id: number, unit: number) =>
    request<SpoilerCheck>(`/watch-groups/${id}/spoiler?unit=${unit}`),

  friendsOnTitle: (provider: string, providerId: string) =>
    request<TitleFriends>(`/media/${provider}/${encodeURIComponent(providerId)}/friends`),
  reactions: (entryId: number) => request<ReactionSummary>(`/entries/${entryId}/reactions`),
  react: (entryId: number, kind: Reaction) =>
    request<ReactionSummary>(`/entries/${entryId}/reactions`, {
      method: "PUT",
      body: body({ kind }),
    }),
  unreact: (entryId: number) =>
    request<ReactionSummary>(`/entries/${entryId}/reactions`, { method: "DELETE" }),
  sharedShelves: (username: string) =>
    request<Shelf[]>(`/users/${encodeURIComponent(username)}/shelves`),

  shelves: () => request<Shelf[]>("/shelves"),
  shelf: (id: number) => request<Shelf>(`/shelves/${id}`),
  createShelf: (input: { name: string; description?: string | null }) =>
    request<Shelf>("/shelves", { method: "POST", body: body(input) }),
  updateShelf: (id: number, patch: Record<string, unknown>) =>
    request<Shelf>(`/shelves/${id}`, { method: "PATCH", body: body(patch) }),
  deleteShelf: (id: number) => request<void>(`/shelves/${id}`, { method: "DELETE" }),
  addToShelf: (id: number, entryId: number) =>
    request<Shelf>(`/shelves/${id}/items`, { method: "POST", body: body({ entry_id: entryId }) }),
  removeFromShelf: (id: number, entryId: number) =>
    request<void>(`/shelves/${id}/items/${entryId}`, { method: "DELETE" }),
  reorderShelf: (id: number, entryIds: number[]) =>
    request<Shelf>(`/shelves/${id}/order`, { method: "PUT", body: body({ entry_ids: entryIds }) }),

  importMal: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ImportJob>("/import/mal", { method: "POST", body: form });
  },
  importJob: (id: number) => request<ImportJob>(`/import/jobs/${id}`),
  importJobs: () => request<ImportJob[]>("/import/jobs"),

  friends: () => request<Friends>("/friends"),
  sendFriendRequest: (username: string) =>
    request<Friendship>("/friends/requests", { method: "POST", body: body({ username }) }),
  acceptFriendRequest: (id: number) =>
    request<Friendship>(`/friends/requests/${id}/accept`, { method: "POST" }),
  declineFriendRequest: (id: number) =>
    request<void>(`/friends/requests/${id}/decline`, { method: "POST" }),
  /** Unfriend, or withdraw a request you sent — same endpoint either way. */
  removeFriend: (userId: number) => request<void>(`/friends/${userId}`, { method: "DELETE" }),
  searchUsers: (q: string) =>
    request<PublicUser[]>(`/users/search?q=${encodeURIComponent(q)}`),
  profile: (username: string) => request<Profile>(`/users/${encodeURIComponent(username)}`),
  compare: (username: string) =>
    request<Comparison>(`/users/${encodeURIComponent(username)}/compare`),
  /** One current title per friend — a row of people, not a feed of events. */
  friendsWatching: () => request<WatchingItem[]>("/friends/watching"),
  recommendations: () => request<Recommendations>("/recommendations"),

  feed: () => request<FeedItem[]>("/feed"),
  schedule: () => request<AiringEpisode[]>("/schedule"),
  discover: () => request<DiscoverUser[]>("/discover"),
  leaderboard: () => request<{ rows: LeaderboardRow[] }>("/leaderboard"),

  users: () => request<User[]>("/admin/users"),
  /** The temporary password comes back exactly once — it is never stored in clear. */
  createUser: (input: { email: string; username: string; role?: Role }) =>
    request<{ user: User; temporary_password: string }>("/admin/users", {
      method: "POST",
      body: body(input),
    }),
  updateUser: (id: number, patch: Record<string, unknown>) =>
    request<User>(`/admin/users/${id}`, { method: "PATCH", body: body(patch) }),
  deleteUser: (id: number) => request<void>(`/admin/users/${id}`, { method: "DELETE" }),
};
