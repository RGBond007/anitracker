import { describe, expect, it } from "vitest";

import type { Entry } from "../../lib/api-client";
import { genresAvailable, tonightQueue } from "./tonight";

let nextId = 1;
const entry = (overrides: Record<string, unknown> = {}): Entry => {
  const media = (overrides.media ?? {}) as Record<string, unknown>;
  delete overrides.media;
  return {
    id: nextId++,
    status: "planned",
    score: null,
    progress: 0,
    rewatch_count: 0,
    start_date: null,
    finish_date: null,
    notes: null,
    updated_at: new Date().toISOString(),
    ...overrides,
    media: {
      provider: "t",
      provider_id: `p${nextId}`,
      type: "anime",
      synonyms: [],
      genres: [],
      total_units: 24,
      duration: 24,
      ...media,
    },
  } as Entry;
};

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const OPTS = {
  minutes: 50 as const,
  fresh: false,
  type: "anime" as const,
  genre: null,
  withFriends: false,
};

describe("tonightQueue", () => {
  it("continue mode wants something begun and unfinished", () => {
    const current = entry({ status: "current", progress: 5 });
    const finished = entry({ status: "current", progress: 24 });
    const planned = entry({ status: "planned" });
    const queue = tonightQueue([current, finished, planned], OPTS);
    expect(queue.map((p) => p.entry.id)).toEqual([current.id]);
  });

  it("fresh mode wants the untouched", () => {
    const current = entry({ status: "current", progress: 5 });
    const planned = entry({ status: "planned" });
    const queue = tonightQueue([current, planned], { ...OPTS, fresh: true });
    expect(queue.map((p) => p.entry.id)).toEqual([planned.id]);
  });

  it("excludes what cannot fit the sitting at all", () => {
    const short = entry({
      status: "planned",
      media: { format: "MOVIE", total_units: 1, duration: 85 },
    });
    const long = entry({
      status: "planned",
      media: { format: "MOVIE", total_units: 1, duration: 110 },
    });
    // Neither fits half an hour; the 85-minute one fits an evening, and a
    // 110-minute film honestly does not fit 90 minutes either.
    expect(tonightQueue([short, long], { ...OPTS, fresh: true, minutes: 25 })).toEqual([]);
    const evening = tonightQueue([short, long], { ...OPTS, fresh: true, minutes: 90 });
    expect(evening.map((p) => p.entry.id)).toEqual([short.id]);
    expect(evening[0].reasons).toContainEqual({ kind: "fitMovie", minutes: 85 });
  });

  it("says how many episodes fit and how long they run", () => {
    const show = entry({ status: "current", progress: 3 });
    const [pick] = tonightQueue([show], OPTS);
    expect(pick.reasons).toContainEqual({ kind: "fitEpisodes", units: 2, minutes: 48 });
  });

  it("puts a finishable title first, whatever else is on offer", () => {
    const oneLeft = entry({ status: "current", progress: 23, updated_at: ago(20) });
    const warm = entry({ status: "current", progress: 3, updated_at: ago(0) });
    const queue = tonightQueue([warm, oneLeft], OPTS);
    expect(queue[0].entry.id).toBe(oneLeft.id);
    expect(queue[0].reasons).toContainEqual({ kind: "finishable", left: 1 });
  });

  it("caps the fit at what is actually left", () => {
    const oneLeft = entry({ status: "current", progress: 23 });
    const [pick] = tonightQueue([oneLeft], OPTS);
    expect(pick.reasons).toContainEqual({ kind: "fitEpisodes", units: 1, minutes: 24 });
  });

  it("holds the queue to a chosen genre", () => {
    const fantasy = entry({ status: "planned", media: { genres: ["Fantasy"] } });
    const drama = entry({ status: "planned", media: { genres: ["Drama"] } });
    const queue = tonightQueue([fantasy, drama], { ...OPTS, fresh: true, genre: "Fantasy" });
    expect(queue.map((p) => p.entry.id)).toEqual([fantasy.id]);
  });

  it("prefers, never requires, friends when asked to", () => {
    const plain = entry({ status: "planned" });
    const social = entry({ status: "planned" });
    const key = `${social.media.provider}:${social.media.provider_id}`;
    const friends = new Map([[key, [{ name: "Mika", kind: "watching" as const }]]]);

    const queue = tonightQueue([plain, social], { ...OPTS, fresh: true, withFriends: true }, friends);
    expect(queue[0].entry.id).toBe(social.id);
    expect(queue[0].reasons).toContainEqual({ kind: "friendWatching", name: "Mika" });
    // The friendless title is still offered — a preference is not a filter.
    expect(queue).toHaveLength(2);
  });

  it("mentions how long something sat on hold", () => {
    const held = entry({ status: "on_hold", progress: 7, updated_at: ago(45) });
    const [pick] = tonightQueue([held], OPTS);
    expect(pick.reasons).toContainEqual({ kind: "onHold", days: 45 });
  });

  it("speaks in chapters for manga and never invents a duration", () => {
    const manga = entry({
      status: "current",
      progress: 10,
      media: { type: "manga", total_units: 100, duration: null },
    });
    const [pick] = tonightQueue([manga], { ...OPTS, type: "manga", minutes: 25 });
    expect(pick.reasons).toContainEqual({ kind: "fitChapters", units: 3 });
  });

  it("an empty library is an empty queue, not an error", () => {
    expect(tonightQueue([], OPTS)).toEqual([]);
  });
});

describe("genresAvailable", () => {
  it("lists the pool's genres by weight and skips dropped titles", () => {
    const entries = [
      entry({ media: { genres: ["Drama", "Fantasy"] } }),
      entry({ media: { genres: ["Drama"] } }),
      entry({ status: "dropped", media: { genres: ["Horror"] } }),
    ];
    expect(genresAvailable(entries, "anime")).toEqual(["Drama", "Fantasy"]);
  });
});
