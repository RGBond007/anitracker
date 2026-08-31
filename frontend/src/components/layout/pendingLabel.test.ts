import { describe, expect, it } from "vitest";

import { pendingNavLabel } from "./pendingLabel";

/**
 * The bug this file exists for: the phone badge was `aria-hidden` and nothing else
 * carried its number, so a screen-reader user heard "Friends" whether three people
 * were waiting on them or nobody was. The desktop badge was not hidden, which was
 * worse in its own way — it read out as "Friends 3", a digit with nothing to say
 * what it counted.
 *
 * `t` is stubbed rather than mocked out of i18next: what matters here is which
 * keys get chosen and when, not the English wording, which is free to change.
 */
const t = (key: string, options: Record<string, unknown> = {}) => {
  const count = options.count as number | undefined;
  // Mirrors i18next's own plural selection for English.
  const plural = count === undefined ? "" : count === 1 ? "_one" : "_other";
  const resolved = `${key}${plural}`;
  const args = Object.entries(options)
    .filter(([k]) => k !== "count")
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(",");
  return count !== undefined ? `${resolved}(${count})` : `${resolved}(${args})`;
};

describe("pendingNavLabel", () => {
  it("says nothing at all when nothing is waiting", () => {
    // The normal state, on every navigation. "Friends, 0 pending items" is noise,
    // and an accessible name that grows a clause saying nothing happened is worse
    // than the plain one.
    expect(pendingNavLabel(t, "Friends", { requests: 0, recommendations: 0 })).toBe("Friends");
  });

  it("never announces a zero half", () => {
    const onlyRequests = pendingNavLabel(t, "Friends", { requests: 2, recommendations: 0 });
    expect(onlyRequests).toContain("pendingRequests_other(2)");
    expect(onlyRequests).not.toContain("pendingRecommendations");

    const onlyRecommendations = pendingNavLabel(t, "Friends", { requests: 0, recommendations: 1 });
    expect(onlyRecommendations).toContain("pendingRecommendations_one(1)");
    expect(onlyRecommendations).not.toContain("pendingRequests");
  });

  it("keeps the two kinds apart rather than summing them", () => {
    // A friend waiting on an answer is a different errand from a title someone
    // sent you, and "3 pending items" hides which one is which.
    const both = pendingNavLabel(t, "Friends", { requests: 2, recommendations: 1 });
    expect(both).toContain("pendingRequests_other(2)");
    expect(both).toContain("pendingRecommendations_one(1)");
    expect(both).toContain("pendingJoin");
  });

  it("uses the singular for exactly one of either kind", () => {
    expect(pendingNavLabel(t, "Friends", { requests: 1, recommendations: 0 })).toContain(
      "pendingRequests_one(1)",
    );
    expect(pendingNavLabel(t, "Friends", { requests: 0, recommendations: 1 })).toContain(
      "pendingRecommendations_one(1)",
    );
  });

  it("builds on the visible label rather than replacing it", () => {
    // The accessible name has to start with the word on screen, or a voice-control
    // user saying "click Friends" has nothing to match.
    const label = pendingNavLabel(t, "Freunde", { requests: 1, recommendations: 0 });
    expect(label).toContain("label=Freunde");
  });

  it("treats a negative or missing count as nothing waiting", () => {
    // Defensive: the counts are derived from list lengths, but a future source
    // that answers -1 for "unknown" must not produce "Friends, -1 friend requests".
    expect(pendingNavLabel(t, "Friends", { requests: -1, recommendations: 0 })).toBe("Friends");
  });
});

/**
 * Both navigations must say the same thing: they lead to the same screen, and a
 * phone bar disagreeing with a desktop bar means one of them is wrong.
 */
describe("both navigations read one source", () => {
  const sources = import.meta.glob("/src/components/layout/*.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const read = (name: string) =>
    Object.entries(sources).find(([path]) => path.endsWith(name))?.[1] ?? "";

  it("computes the pending sum in neither bar", () => {
    // Each used to carry its own `incoming.length + recommendations`. They agreed
    // by luck, not by design.
    for (const file of ["/TopBar.tsx", "/BottomNav.tsx"]) {
      const body = read(file);
      expect(body, file).toContain("usePendingNav");
      expect(body, file).not.toMatch(/incoming\.length/);
    }
  });

  it("hides the visual badge from screen readers in both", () => {
    // Otherwise the count is announced twice: once as a bare number inside the
    // link, and once in the name that explains it.
    for (const file of ["/TopBar.tsx", "/BottomNav.tsx"]) {
      const badge = read(file).slice(read(file).indexOf("rounded-pill bg-stamp") - 400);
      expect(badge.slice(0, 500), file).toContain("aria-hidden");
    }
  });
});
