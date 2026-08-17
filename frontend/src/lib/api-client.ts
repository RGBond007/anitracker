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
  sequel_id?: string | null;
  genres: string[];
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
 * One season of a show: its own artwork and episode count, plus the viewer's own
 * progress on it. `entry` is null for a season that exists but is not on the list.
 */
export interface Season {
  media: Media;
  season_number: number;
  entry: Entry | null;
}

export interface Series {
  root_provider_id: string;
  /** The show's name, with any "Season N" suffix taken off. */
  title: string;
  seasons: Season[];
  /** The season to open on: the saved pick, else the one being watched. */
  selected_provider_id: string;
  /** True when the pick was made by the user rather than inferred. */
  is_explicit: boolean;
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
  /** True until an admin-issued one-time password has been replaced. */
  must_change_password: boolean;
  created_at: string;
}

export interface Instance {
  instance_name: string;
  logo_url: string;
  accent_color: string;
  setup_complete: boolean;
  allow_signup: boolean;
  version: string;
  license_tier: string;
}

/** Another user, as seen by you. Never carries email or role — the API strips them. */
export interface PublicUser {
  id: number;
  username: string;
  profile_public: boolean;
  created_at: string;
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
  entries: Entry[];
}

export interface ComparisonRow {
  media: Media;
  mine: Entry | null;
  theirs: Entry | null;
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
  entry: Entry;
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
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(init.headers ?? {}),
    },
  });

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
    request<Omit<Instance, "setup_complete" | "version" | "license_tier">>("/admin/instance", {
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
  revokeSessions: () => request<void>("/me/sessions/revoke", { method: "POST" }),
  changePassword: (current_password: string, new_password: string) =>
    request<void>("/me/password", { method: "POST", body: body({ current_password, new_password }) }),

  search: (q: string, type: MediaType, page = 1) =>
    request<{ results: Media[]; page: number; has_more: boolean }>(
      `/media/search?q=${encodeURIComponent(q)}&type=${type}&page=${page}`,
    ),
  media: (provider: string, providerId: string, type: MediaType) =>
    request<Media>(`/media/${provider}/${providerId}?type=${type}`),

  /** Every season of the show this title belongs to, with the viewer's progress. */
  series: (provider: string, providerId: string, type: MediaType) =>
    request<Series>(`/media/${provider}/${providerId}/series?type=${type}`),
  /** Answers with the whole series, so the caller never has to guess the new state. */
  selectSeason: (rootProviderId: string, providerId: string) =>
    request<Series>(`/series/${rootProviderId}/season`, {
      method: "PUT",
      body: body({ provider_id: providerId }),
    }),
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
