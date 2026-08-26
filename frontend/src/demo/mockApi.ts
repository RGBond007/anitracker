import type {
  AiringEpisode,
  Comparison,
  Dashboard,
  DiscoverUser,
  Entry,
  EntryStatus,
  FeedItem,
  FriendRecommendation,
  Friends,
  Instance,
  LeaderboardRow,
  Media,
  Profile,
  PublicUser,
  Recommendations,
  Season,
  Series,
  Shelf,
  User,
  WatchGroup,
} from "../lib/api-client";

const LIBRARY_KEY = "anitracker-real-demo-library-v2";
const USER_KEY = "anitracker-real-demo-user-v1";
const SHELVES_KEY = "anitracker-real-demo-shelves-v1";
const RECS_KEY = "anitracker-real-demo-recommendations-v1";
const WATCH_KEY = "anitracker-real-demo-watch-groups-v1";

// These are provider-owned URLs, exactly like the cover/banner URLs returned to
// a normal AniTracker instance. Keeping them out of the repository avoids
// redistributing third-party artwork; the generated SVG below remains a fallback.
const providerArt: Record<string, { cover: string; banner?: string }> = {
  frieren: {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
  },
  "vinland-saga": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101348-2fhDFPCuMNiz.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101348-pivKKffCAwAY.jpg",
  },
  "dungeon-meshi": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx153518-IVXPDY5ph3kO.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/153518-7uRvV7SLqmHV.jpg",
  },
  pluto: {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx99088-LTJskMD1wbbQ.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/99088-KFYEoH7jCF0b.jpg",
  },
  "mob-psycho": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21507-6YUSbh2m0N1p.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21507-Qx8bGsLXUgLo.jpg",
  },
  eizouken: {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx109298-suwdIUbJEPJx.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/109298-ej4YYg87HHoA.jpg",
  },
  "aot-1": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg",
  },
  "aot-2": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20958-HuFJyr54Mmir.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/20958-Y7eQdz9VENBD.jpg",
  },
  "aot-3": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx99147-AiPDD8cwlCfi.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/99147-HACsFVrynFf5.jpg",
  },
  "odd-taxi": {
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx128547-nNekWTKqmvEi.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/128547-aVWJmZz9dwJJ.jpg",
  },
};

const svgArt = (title: string, a: string, b: string, wide = false) => {
  const safeTitle = title.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  const width = wide ? 1200 : 600;
  const height = wide ? 500 : 900;
  const fontSize = wide ? 68 : 44;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><pattern id="p" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#f1ece1" opacity=".18"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#p)"/><circle cx="${wide ? 940 : 420}" cy="${wide ? 90 : 230}" r="${wide ? 260 : 210}" fill="none" stroke="#f1ece1" stroke-opacity=".35" stroke-width="5"/><path d="M-${wide ? 40 : 20} ${height * 0.7} L${width * 0.7} ${height * 0.2} L${width * 1.1} ${height * 0.65}" fill="none" stroke="#0d0c10" stroke-opacity=".45" stroke-width="${wide ? 48 : 32}"/><text x="${wide ? 62 : 42}" y="${height - (wide ? 58 : 70)}" fill="#f1ece1" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700">${safeTitle}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const media = (
  provider_id: string,
  title: string,
  year: number,
  total: number,
  colors: [string, string],
  extra: Partial<Media> = {},
): Media => ({
  provider: "demo",
  provider_id,
  type: "anime",
  title_romaji: title,
  title_english: title,
  title_native: title,
  synonyms: [],
  cover_url: providerArt[provider_id]?.cover ?? svgArt(title, colors[0], colors[1]),
  banner_url: providerArt[provider_id]?.banner ?? svgArt(title, colors[0], colors[1], true),
  synopsis: "A hand-picked title in the AniTracker demo catalogue. Explore its details, add it to your list, and change the progress just as you would on a self-hosted instance.",
  total_units: total,
  format: "TV",
  status: "FINISHED",
  season_year: year,
  genres: ["Adventure", "Drama"],
  average_score: 84,
  duration: 24,
  start_date: `${year}-01-01`,
  root_provider_id: provider_id,
  ...extra,
});

const catalogue: Media[] = [
  media("frieren", "Frieren: Beyond Journey's End", 2023, 28, ["#3d6266", "#aeb5a1"], { genres: ["Adventure", "Drama", "Fantasy"], average_score: 91 }),
  media("vinland-saga", "Vinland Saga", 2019, 24, ["#723c2e", "#bd8d5e"], { genres: ["Action", "Adventure", "Drama"], average_score: 88 }),
  media("dungeon-meshi", "Delicious in Dungeon", 2024, 24, ["#3d6244", "#c6aa57"], { genres: ["Adventure", "Comedy", "Fantasy"], average_score: 86 }),
  media("pluto", "PLUTO", 2023, 8, ["#34485f", "#a76d65"], { format: "ONA", genres: ["Drama", "Mystery", "Sci-Fi"], average_score: 89 }),
  media("mob-psycho", "Mob Psycho 100", 2016, 12, ["#5f4974", "#c9829a"], { genres: ["Action", "Comedy", "Supernatural"], average_score: 87 }),
  media("eizouken", "Keep Your Hands Off Eizouken!", 2020, 12, ["#337078", "#d1974d"], { genres: ["Adventure", "Comedy"], average_score: 82 }),
  media("aot-1", "Attack on Titan", 2013, 25, ["#59483e", "#9c6d58"], { root_provider_id: "aot", season_number: 1, sequel_id: "aot-2", genres: ["Action", "Drama", "Mystery"], average_score: 85 }),
  media("aot-2", "Attack on Titan Season 2", 2017, 12, ["#493a38", "#93685d"], { root_provider_id: "aot", season_number: 2, prequel_id: "aot-1", sequel_id: "aot-3", genres: ["Action", "Drama", "Mystery"], average_score: 86 }),
  media("aot-3", "Attack on Titan Season 3", 2018, 22, ["#3d4146", "#887566"], { root_provider_id: "aot", season_number: 3, prequel_id: "aot-2", genres: ["Action", "Drama", "Mystery"], average_score: 89 }),
  media("odd-taxi", "ODDTAXI", 2021, 13, ["#3e4c5c", "#a77b4c"], { genres: ["Drama", "Mystery"], average_score: 88 }),
];

const now = () => new Date().toISOString();
const makeEntry = (id: number, providerId: string, status: EntryStatus, progress: number, score: number | null): Entry => ({
  id,
  status,
  score,
  progress,
  rewatch_count: 0,
  start_date: status === "planned" ? null : "2026-07-01",
  finish_date: status === "completed" ? "2026-08-01" : null,
  notes: null,
  updated_at: now(),
  media: structuredClone(catalogue.find((item) => item.provider_id === providerId)!),
});

const initialEntries = (): Entry[] => [
  makeEntry(1, "frieren", "current", 18, 9),
  makeEntry(2, "vinland-saga", "current", 7, 9),
  makeEntry(3, "dungeon-meshi", "current", 14, 8),
  makeEntry(4, "pluto", "completed", 8, 9),
  makeEntry(5, "aot-3", "current", 7, 9),
  makeEntry(6, "odd-taxi", "planned", 0, null),
];

const demoUser: User = {
  id: 1,
  email: "demo@anitracker.local",
  username: "Demo User",
  role: "user",
  title_language: "english",
  ui_language: "en",
  theme: "dark",
  profile_public: true,
  must_change_password: false,
  avatar_url: null,
  created_at: "2026-08-01T10:00:00Z",
};

const instance: Instance = {
  instance_name: "AniTracker",
  logo_url: "",
  accent_color: "#d4af37",
  setup_complete: true,
  allow_signup: false,
  // Read from the bundle rather than hardcoded, so the demo footer cannot drift
  // from the release the way it did between 2.0.1 and 2.1.0.
  version: `${__APP_VERSION__}-demo`,
  license: "AGPL-3.0-only",
};

const friend: PublicUser = { id: 2, username: "Mika", profile_public: true, avatar_url: null, created_at: "2026-06-12T08:00:00Z" };

function readEntries(): Entry[] {
  try {
    const stored = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "null") as Entry[] | null;
    return Array.isArray(stored) ? stored : initialEntries();
  } catch {
    return initialEntries();
  }
}

function writeEntries(entries: Entry[]) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries));
}

/**
 * Shelves start empty here, exactly as they do on a real instance: the point of
 * the feature is that nobody is given a shelf they did not ask for, and seeding
 * the demo with three would misrepresent what a fresh install looks like.
 */
function readShelves(): Shelf[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SHELVES_KEY) ?? "null") as Shelf[] | null;
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeShelves(shelves: Shelf[]) {
  localStorage.setItem(SHELVES_KEY, JSON.stringify(shelves));
}

/** The stored shape holds ids; `items` is filled in from the library on read. */
function shelfOut(shelf: Shelf, entries: Entry[], withItems: boolean): Shelf {
  const live = shelf.entry_ids.filter((id) => entries.some((entry) => entry.id === id));
  return {
    ...shelf,
    entry_ids: live,
    item_count: live.length,
    items: withItems
      ? live.map((id, position) => ({
          entry: entries.find((entry) => entry.id === id) as Entry,
          position,
        }))
      : null,
  };
}

/**
 * The demo ships one waiting recommendation from Mika, because an empty inbox
 * renders nothing at all and the whole point of the demo is to show the feature.
 * Everything after that is whatever the visitor does in their own browser.
 */
function seededRecommendations(): FriendRecommendation[] {
  return [
    {
      id: 1,
      sender: friend,
      recipient: { id: 1, username: demoUser.username, profile_public: true, avatar_url: null, created_at: demoUser.created_at },
      provider: "demo",
      provider_id: "mob-psycho",
      media_type: "anime",
      message: "Twelve episodes and the animation goes somewhere else entirely. No spoilers.",
      state: "pending",
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      media: catalogue.find((item) => item.provider_id === "mob-psycho") ?? null,
    },
  ];
}

function readRecommendations(): FriendRecommendation[] {
  try {
    const stored = JSON.parse(localStorage.getItem(RECS_KEY) ?? "null") as FriendRecommendation[] | null;
    return Array.isArray(stored) ? stored : seededRecommendations();
  } catch {
    return seededRecommendations();
  }
}

function writeRecommendations(rows: FriendRecommendation[]) {
  localStorage.setItem(RECS_KEY, JSON.stringify(rows));
}

/**
 * Watch-together groups. Empty until the visitor starts one -- the same as a real
 * instance, where a group exists because somebody proposed it.
 */
function readWatchGroups(): WatchGroup[] {
  try {
    const stored = JSON.parse(localStorage.getItem(WATCH_KEY) ?? "null") as WatchGroup[] | null;
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeWatchGroups(groups: WatchGroup[]) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(groups));
}

/** Fills each joined member's episode from the library, as the server does. */
function watchOut(group: WatchGroup, entries: Entry[]): WatchGroup {
  const own = entries.find((e) => e.media.provider_id === group.provider_id);
  return {
    ...group,
    members: group.members.map((m) =>
      m.state !== "joined"
        ? { ...m, progress: null }
        : { ...m, progress: m.user.id === 1 ? (own?.progress ?? null) : m.progress },
    ),
    media: catalogue.find((c) => c.provider_id === group.provider_id) ?? null,
  };
}

function readUser(): User {
  try {
    return { ...demoUser, ...JSON.parse(localStorage.getItem(USER_KEY) ?? "{}") } as User;
  } catch {
    return demoUser;
  }
}

function json(value: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function payload(init: RequestInit): Record<string, unknown> {
  if (!init.body || typeof init.body !== "string") return {};
  return JSON.parse(init.body) as Record<string, unknown>;
}

function stats(entries: Entry[], type: "anime" | "manga") {
  const matching = entries.filter((entry) => entry.media.type === type);
  const scored = matching.filter((entry) => entry.score != null);
  const watched = type === "anime" ? matching.reduce((sum, entry) => sum + entry.progress, 0) : 0;
  return {
    counts: (["current", "completed", "on_hold", "dropped", "planned"] as EntryStatus[]).map((status) => ({ status, count: matching.filter((entry) => entry.status === status).length })),
    total: matching.length,
    mean_score: scored.length ? scored.reduce((sum, entry) => sum + (entry.score ?? 0), 0) / scored.length : null,
    scored_count: scored.length,
    episodes_watched: watched,
    chapters_read: type === "manga" ? matching.reduce((sum, entry) => sum + entry.progress, 0) : 0,
    days_watched: watched * 24 / 60 / 24,
  };
}

function dashboard(entries: Entry[]): Dashboard {
  return {
    anime: stats(entries, "anime"),
    manga: stats(entries, "manga"),
    in_progress: entries.filter((entry) => entry.status === "current"),
    recently_updated: [...entries].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  };
}

function seasonsFor(providerId: string, entries: Entry[]): Series {
  const selected = catalogue.find((item) => item.provider_id === providerId)!;
  const members = selected.root_provider_id === "aot"
    ? catalogue.filter((item) => item.root_provider_id === "aot")
    : [selected];
  const seasons: Season[] = members.map((item) => ({
    media: item,
    season_number: item.season_number ?? (members.length === 1 ? 1 : null),
    kind: "season",
    entry: entries.find((entry) => entry.media.provider_id === item.provider_id) ?? null,
    is_current: item.provider_id === (selected.root_provider_id === "aot" ? "aot-3" : selected.provider_id),
  }));
  return {
    root_provider_id: selected.root_provider_id ?? selected.provider_id,
    title: selected.root_provider_id === "aot" ? "Attack on Titan" : selected.title_english ?? "",
    seasons,
    current_provider_id: seasons.find((season) => season.is_current)?.media.provider_id ?? selected.provider_id,
    is_explicit: true,
  };
}

/** Implements the FastAPI surface used by the real frontend, entirely in-browser. */
export async function demoRequest(rawPath: string, init: RequestInit = {}): Promise<Response> {
  await new Promise((resolve) => window.setTimeout(resolve, 90));
  const url = new URL(rawPath, window.location.origin);
  const path = url.pathname;
  const method = (init.method ?? "GET").toUpperCase();
  let entries = readEntries();

  if (path === "/instance") return json(instance);
  if (path === "/me" && method === "GET") return json(readUser());
  if (path === "/me" && method === "PATCH") {
    const user = { ...readUser(), ...payload(init) } as User;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return json(user);
  }
  if (path === "/auth/login") return json(readUser());
  if (path === "/auth/logout" || path === "/me/sessions/revoke" || path === "/me/password") return json(undefined, 204);
  if (path === "/me/avatar" && method === "DELETE") return json({ ...readUser(), avatar_url: null });

  if (path === "/media/trending") {
    const type = url.searchParams.get("type") ?? "anime";
    return json(catalogue.filter((item) => item.type === type).slice(0, Number(url.searchParams.get("limit") ?? 12)));
  }
  if (path === "/media/search") {
    const query = (url.searchParams.get("q") ?? "").toLowerCase();
    const genres = url.searchParams.getAll("genre");
    const results = catalogue.filter((item) =>
      (!query || [item.title_english, item.title_romaji, ...item.synonyms].some((title) => title?.toLowerCase().includes(query))) &&
      (genres.length === 0 || genres.every((genre) => item.genres.includes(genre))),
    );
    return json({ results, page: 1, has_more: false });
  }

  const seriesMatch = path.match(/^\/media\/([^/]+)\/([^/]+)\/series$/);
  if (seriesMatch) return json(seasonsFor(decodeURIComponent(seriesMatch[2]), entries));
  const mediaMatch = path.match(/^\/media\/([^/]+)\/([^/]+)$/);
  if (mediaMatch) {
    const found = catalogue.find((item) => item.provider_id === decodeURIComponent(mediaMatch[2]));
    return found ? json(found) : json({ detail: "Title not found" }, 404);
  }

  if (path === "/series/selections") {
    return json(entries.map((entry) => ({ root_provider_id: entry.media.root_provider_id ?? entry.media.provider_id, provider_id: entry.media.provider_id })));
  }
  const selectSeason = path.match(/^\/series\/([^/]+)\/season$/);
  if (selectSeason && method === "PUT") return json(seasonsFor(String(payload(init).provider_id), entries));

  if (path === "/entries" && method === "GET") {
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    return json(entries.filter((entry) => (!type || entry.media.type === type) && (!status || entry.status === status)));
  }
  if (path === "/entries" && method === "POST") {
    const input = payload(init);
    const found = catalogue.find((item) => item.provider_id === input.provider_id);
    if (!found) return json({ detail: "Title not found" }, 404);
    const existing = entries.find((entry) => entry.media.provider_id === found.provider_id);
    if (existing) return json(existing);
    const entry = makeEntry(Math.max(0, ...entries.map((item) => item.id)) + 1, found.provider_id, (input.status as EntryStatus) ?? "planned", Number(input.progress ?? 0), null);
    entries.unshift(entry);
    writeEntries(entries);
    return json(entry, 201);
  }
  const byMedia = path.match(/^\/entries\/by-media\/[^/]+\/([^/]+)$/);
  if (byMedia) return json(entries.find((entry) => entry.media.provider_id === decodeURIComponent(byMedia[1])) ?? null);
  const increment = path.match(/^\/entries\/(\d+)\/increment$/);
  if (increment && method === "POST") {
    const entry = entries.find((item) => item.id === Number(increment[1]));
    if (!entry) return json({ detail: "Entry not found" }, 404);
    entry.progress = Math.min(entry.media.total_units ?? entry.progress + 1, entry.progress + 1);
    if (entry.media.total_units && entry.progress >= entry.media.total_units) entry.status = "completed";
    entry.updated_at = now();
    writeEntries(entries);
    return json(entry);
  }
  const entryMatch = path.match(/^\/entries\/(\d+)$/);
  if (entryMatch && method === "PATCH") {
    const entry = entries.find((item) => item.id === Number(entryMatch[1]));
    if (!entry) return json({ detail: "Entry not found" }, 404);
    Object.assign(entry, payload(init), { updated_at: now() });
    writeEntries(entries);
    return json(entry);
  }
  if (entryMatch && method === "DELETE") {
    entries = entries.filter((item) => item.id !== Number(entryMatch[1]));
    writeEntries(entries);
    return json(undefined, 204);
  }

  // --- Recommendations between friends ---
  let recs = readRecommendations();
  const recMatch = path.match(/^\/recommendations\/(\d+)$/);
  const recFor = path.match(/^\/recommendations\/for\/([^/]+)\/([^/]+)$/);

  if (path === "/recommendations/inbox" && method === "GET") {
    return json(recs.filter((row) => row.state !== "dismissed"));
  }
  if (path === "/recommendations/sent" && method === "GET") return json([]);
  if (path === "/recommendations" && method === "POST") {
    const input = payload(init) as Record<string, unknown>;
    const ids = (input.recipient_ids as number[]) ?? [];
    // Mirrors the server: an id that resolves to nothing is refused before a row
    // exists, rather than becoming a card with no title.
    const media = catalogue.find((item) => item.provider_id === input.provider_id) ?? null;
    if (!media) return json({ detail: "No such title" }, 404);
    const already = recs.some(
      (row) => row.provider_id === input.provider_id && row.state === "pending",
    );
    if (already) return json({ sent: [], already_pending: ids }, 201);
    const row: FriendRecommendation = {
      id: Math.max(0, ...recs.map((r) => r.id)) + 1,
      sender: { id: 1, username: demoUser.username, profile_public: true, avatar_url: null, created_at: demoUser.created_at },
      recipient: friend,
      provider: String(input.provider ?? "demo"),
      provider_id: String(input.provider_id ?? ""),
      media_type: (input.media_type as "anime" | "manga") ?? "anime",
      message: (String(input.message ?? "").trim() || null) as string | null,
      state: "pending",
      created_at: now(),
      media,
    };
    // Sent recommendations leave this browser in a real instance; here they simply
    // are not added to the visitor's own inbox, which is the truthful stand-in.
    return json({ sent: [row], already_pending: [] }, 201);
  }
  if (recMatch && method === "PATCH") {
    const row = recs.find((item) => item.id === Number(recMatch[1]));
    if (!row) return json({ detail: "Recommendation not found" }, 404);
    row.state = (payload(init).state as FriendRecommendation["state"]) ?? row.state;
    writeRecommendations(recs);
    return json(row);
  }
  if (recFor && method === "GET") {
    return json(
      recs
        .filter((row) => row.provider_id === decodeURIComponent(recFor[2]) && row.state !== "dismissed")
        .map((row) => row.sender),
    );
  }

  // --- Watch-together groups ---
  let watch = readWatchGroups();
  const watchFor = path.match(/^\/watch-groups\/for\/([^/]+)\/([^/]+)$/);
  const watchOne = path.match(/^\/watch-groups\/(\d+)$/);
  const watchAct = path.match(/^\/watch-groups\/(\d+)\/(join|leave|invite)$/);
  const watchSpoil = path.match(/^\/watch-groups\/(\d+)\/spoiler$/);
  const me = { id: 1, username: demoUser.username, profile_public: true, avatar_url: null, created_at: demoUser.created_at };

  if (path === "/watch-groups" && method === "GET") {
    return json(watch.map((g) => watchOut(g, entries)));
  }
  if (path === "/watch-groups" && method === "POST") {
    const input = payload(init) as Record<string, unknown>;
    const invited = ((input.invite_ids as number[]) ?? []).includes(friend.id);
    const group: WatchGroup = {
      id: Math.max(0, ...watch.map((g) => g.id)) + 1,
      provider: String(input.provider ?? "demo"),
      provider_id: String(input.provider_id ?? ""),
      media_type: (input.media_type as "anime" | "manga") ?? "anime",
      target_unit: null,
      is_closed: false,
      my_state: "joined",
      i_own_it: true,
      members: [
        { user: me, state: "joined", progress: null, is_owner: true },
        // Mika joins straight away and sits two episodes back. In a real instance
        // she would be `invited` until she accepted, but nobody can accept inside
        // a one-browser demo -- and an invitation nobody can act on would hide the
        // roster and the spoiler warning, which are the whole feature.
        ...(invited
          ? [
              {
                user: friend,
                state: "joined" as const,
                progress: Math.max(
                  0,
                  (entries.find((e) => e.media.provider_id === String(input.provider_id))?.progress ?? 3) - 2,
                ),
                is_owner: false,
              },
            ]
          : []),
      ],
      media: null,
      created_at: now(),
    };
    watch = [...watch, group];
    writeWatchGroups(watch);
    return json(watchOut(group, entries), 201);
  }
  if (watchFor && method === "GET") {
    const pid = decodeURIComponent(watchFor[2]);
    const group = watch.find((g) => g.provider_id === pid && !g.is_closed);
    return json(group ? watchOut(group, entries) : null);
  }
  if (watchSpoil && method === "GET") {
    const group = watch.find((g) => g.id === Number(watchSpoil[1]));
    if (!group) return json({ detail: "Group not found" }, 404);
    const unit = Number(new URLSearchParams(rawPath.split("?")[1] ?? "").get("unit") ?? 0);
    const behind = group.members
      .filter((m) => m.state === "joined" && m.user.id !== 1 && (m.progress ?? 0) < unit)
      .map((m) => m.user);
    return json({
      unit,
      behind,
      past_target: group.target_unit != null && unit > group.target_unit,
      target_unit: group.target_unit,
    });
  }
  if (watchOne && method === "GET") {
    const group = watch.find((g) => g.id === Number(watchOne[1]));
    return group ? json(watchOut(group, entries)) : json({ detail: "Group not found" }, 404);
  }
  if (watchOne && method === "PATCH") {
    const group = watch.find((g) => g.id === Number(watchOne[1]));
    if (!group) return json({ detail: "Group not found" }, 404);
    group.target_unit = (payload(init).target_unit as number | null) ?? null;
    writeWatchGroups(watch);
    return json(watchOut(group, entries));
  }
  if (watchOne && method === "DELETE") {
    const group = watch.find((g) => g.id === Number(watchOne[1]));
    if (group) { group.is_closed = true; writeWatchGroups(watch); }
    return json(undefined, 204);
  }
  if (watchAct) {
    const group = watch.find((g) => g.id === Number(watchAct[1]));
    if (!group) return json({ detail: "Group not found" }, 404);
    if (watchAct[2] === "leave") {
      watch = watch.filter((g) => g.id !== group.id);
      writeWatchGroups(watch);
      return json(undefined, 204);
    }
    if (watchAct[2] === "invite") {
      // Mika accepts immediately here and sits a couple of episodes back, so the
      // spoiler warning has something true to say.
      const own = entries.find((e) => e.media.provider_id === group.provider_id);
      if (!group.members.some((m) => m.user.id === friend.id)) {
        group.members.push({
          user: friend,
          state: "joined",
          progress: Math.max(0, (own?.progress ?? 3) - 2),
          is_owner: false,
        });
      }
    }
    writeWatchGroups(watch);
    return json(watchOut(group, entries));
  }

  // --- Small social moments ---
  const onTitle = path.match(/^\/media\/([^/]+)\/([^/]+)\/friends$/);
  const reactions = path.match(/^\/entries\/(\d+)\/reactions$/);
  const sharedShelves = path.match(/^\/users\/([^/]+)\/shelves$/);

  if (onTitle && method === "GET") {
    const providerId = decodeURIComponent(onTitle[2]);
    const media = catalogue.find((item) => item.provider_id === providerId);
    const own = entries.find((entry) => entry.media.provider_id === providerId);
    // Mika has an opinion on a handful of titles, so the comparison has something
    // to compare. Everything else honestly returns nobody.
    const hers: Record<string, { status: EntryStatus; score: number | null; progress: number }> = {
      frieren: { status: "completed", score: 10, progress: 28 },
      "vinland-saga": { status: "current", score: 8, progress: 12 },
      "mob-psycho": { status: "completed", score: 9, progress: 12 },
    };
    const her = media ? hers[providerId] : undefined;
    return json({
      friends: her ? [{ user: friend, ...her }] : [],
      my_score: own?.score ?? null,
    });
  }
  if (reactions && method === "GET") {
    return json({ entry_id: Number(reactions[1]), reactions: [], mine: null });
  }
  if (reactions && (method === "PUT" || method === "DELETE")) {
    const kind = method === "PUT" ? (payload(init).kind as string) : null;
    return json({
      entry_id: Number(reactions[1]),
      reactions: kind ? [{ user: { id: 1, username: demoUser.username, profile_public: true, avatar_url: null, created_at: demoUser.created_at }, kind, created_at: now() }] : [],
      mine: kind,
    });
  }
  if (sharedShelves && method === "GET") {
    const who = decodeURIComponent(sharedShelves[1]);
    if (who === demoUser.username) {
      return json(readShelves().filter((shelf) => shelf.is_shared).map((shelf) => shelfOut(shelf, entries, false)));
    }
    // Mika shares one, so a profile has something to show.
    return json([
      {
        id: 900, name: "Comfort rewatches", description: "The ones that always work.",
        position: 0, is_shared: true, items: null, entry_ids: [], item_count: 6,
        created_at: now(), updated_at: now(),
      },
    ]);
  }

  if (path === "/dashboard") return json(dashboard(entries));
  if (path === "/schedule") return json([] satisfies AiringEpisode[]);
  // Completed rather than mid-watch: completion reactions only appear on a finish,
  // and a demo feed with nothing finished would never show them.
  if (path === "/feed") return json([{ user: friend, entry: makeEntry(90, "mob-psycho", "completed", 12, 9) }] satisfies FeedItem[]);
  if (path === "/friends") return json({ friends: [{ id: 1, user: friend, state: "accepted", stats: { tracked: 42, mean_score: 8.4, in_common: 3 }, direction: "outgoing", created_at: "2026-07-01T10:00:00Z" }], incoming: [], outgoing: [] } satisfies Friends);
  if (path === "/friends/watching") return json([{ user: friend, entry: makeEntry(91, "eizouken", "current", 4, 8) }]);
  if (path === "/recommendations") return json({ featured: null, because: catalogue[0], personal: [] } satisfies Recommendations);
  if (path === "/discover") return json([{ user: friend, tracked: 42 }] satisfies DiscoverUser[]);
  if (path === "/leaderboard") return json({ rows: [{ user: { ...demoUser, username: demoUser.username }, is_self: true, episodes_watched: stats(entries, "anime").episodes_watched, chapters_read: 0, completed: entries.filter((entry) => entry.status === "completed").length, mean_score: stats(entries, "anime").mean_score }, { user: friend, is_self: false, episodes_watched: 311, chapters_read: 0, completed: 18, mean_score: 8.4 }] satisfies LeaderboardRow[] });
  if (path.startsWith("/users/search")) return json([friend]);
  if (path === "/users/Mika") return json({ user: friend, relationship: "friends", visible: true, anime: stats([makeEntry(92, "mob-psycho", "completed", 12, 9)], "anime"), manga: stats([], "manga"), entries: [makeEntry(92, "mob-psycho", "completed", 12, 9)] } satisfies Profile);
  if (path === "/users/Mika/compare") return json({ user: friend, shared: [], only_theirs: [], both_scored: 0, mean_difference: null } satisfies Comparison);
  if (path === "/admin/users") return json([readUser()]);
  if (path === "/import/jobs") return json([]);

  // --- Shelves ---
  let shelves = readShelves();
  const shelfMatch = path.match(/^\/shelves\/(\d+)$/);
  const shelfItems = path.match(/^\/shelves\/(\d+)\/items$/);
  const shelfItem = path.match(/^\/shelves\/(\d+)\/items\/(\d+)$/);
  const shelfOrder = path.match(/^\/shelves\/(\d+)\/order$/);
  const find = (raw: string) => shelves.find((shelf) => shelf.id === Number(raw));

  if (path === "/shelves" && method === "GET") {
    return json(shelves.map((shelf) => shelfOut(shelf, entries, false)));
  }
  if (path === "/shelves" && method === "POST") {
    const input = payload(init);
    const name = String(input.name ?? "").trim();
    if (!name) return json({ detail: "Name cannot be blank" }, 422);
    if (shelves.some((shelf) => shelf.name === name)) {
      return json({ detail: "A shelf with that name already exists" }, 409);
    }
    const shelf: Shelf = {
      id: Math.max(0, ...shelves.map((item) => item.id)) + 1,
      name,
      description: String(input.description ?? "").trim() || null,
      position: shelves.length,
      is_shared: false,
      items: null,
      entry_ids: [],
      item_count: 0,
      created_at: now(),
      updated_at: now(),
    };
    shelves = [...shelves, shelf];
    writeShelves(shelves);
    return json(shelfOut(shelf, entries, false), 201);
  }
  if (shelfMatch && method === "GET") {
    const shelf = find(shelfMatch[1]);
    return shelf ? json(shelfOut(shelf, entries, true)) : json({ detail: "Shelf not found" }, 404);
  }
  if (shelfMatch && method === "PATCH") {
    const shelf = find(shelfMatch[1]);
    if (!shelf) return json({ detail: "Shelf not found" }, 404);
    const input = payload(init);
    if ("name" in input) {
      const name = String(input.name ?? "").trim();
      if (!name) return json({ detail: "Name cannot be blank" }, 422);
      if (shelves.some((other) => other.name === name && other.id !== shelf.id)) {
        return json({ detail: "A shelf with that name already exists" }, 409);
      }
      shelf.name = name;
    }
    if ("description" in input) {
      shelf.description = String(input.description ?? "").trim() || null;
    }
    if ("is_shared" in input) shelf.is_shared = Boolean(input.is_shared);
    shelf.updated_at = now();
    writeShelves(shelves);
    return json(shelfOut(shelf, entries, false));
  }
  if (shelfMatch && method === "DELETE") {
    shelves = shelves.filter((shelf) => shelf.id !== Number(shelfMatch[1]));
    writeShelves(shelves);
    return json(undefined, 204);
  }
  if (shelfItems && method === "POST") {
    const shelf = find(shelfItems[1]);
    if (!shelf) return json({ detail: "Shelf not found" }, 404);
    const entryId = Number(payload(init).entry_id);
    if (!entries.some((entry) => entry.id === entryId)) {
      return json({ detail: "Entry not found" }, 404);
    }
    if (!shelf.entry_ids.includes(entryId)) shelf.entry_ids = [...shelf.entry_ids, entryId];
    shelf.updated_at = now();
    writeShelves(shelves);
    return json(shelfOut(shelf, entries, true));
  }
  if (shelfItem && method === "DELETE") {
    const shelf = find(shelfItem[1]);
    if (!shelf) return json({ detail: "Shelf not found" }, 404);
    shelf.entry_ids = shelf.entry_ids.filter((id) => id !== Number(shelfItem[2]));
    writeShelves(shelves);
    return json(undefined, 204);
  }
  if (shelfOrder && method === "PUT") {
    const shelf = find(shelfOrder[1]);
    if (!shelf) return json({ detail: "Shelf not found" }, 404);
    const wanted = (payload(init).entry_ids as number[]) ?? [];
    shelf.entry_ids = wanted.filter((id) => shelf.entry_ids.includes(id));
    shelf.updated_at = now();
    writeShelves(shelves);
    return json(shelfOut(shelf, entries, true));
  }

  return json({ detail: `Demo endpoint not implemented: ${method} ${path}` }, 404);
}
