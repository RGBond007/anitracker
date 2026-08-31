import { useCallback, useEffect, useState } from "react";

import { useMe } from "../auth/useAuth";

/**
 * How this person wants their dashboard arranged.
 *
 * The dashboard makes a run of decisions on somebody's behalf before it ever shows
 * them their own titles — what to watch tonight, what is airing, what friends
 * finished. Every one of those is useful to somebody and noise to somebody else,
 * and which is which is not knowable from here. So it is answerable.
 *
 * Curated by default and never mandatory: an account that never opens the settings
 * gets exactly the arrangement it always had. Nothing is stored until something is
 * changed.
 *
 * Per user, not per browser. Two accounts sharing a laptop is the ordinary case on
 * a self-hosted instance — a household — and one person's tidied dashboard should
 * not rearrange the other's.
 *
 * The hero is deliberately absent from all of this. It is the page's answer to the
 * question the page exists to ask; a dashboard with it hidden is a blank one.
 */
export type SectionId = "stats" | "tonight" | "schedule" | "inProgress" | "recent" | "friends";

/** The body sections, in the order the app recommends. */
export const DEFAULT_ORDER: SectionId[] = ["tonight", "schedule", "inProgress", "recent", "friends"];

/**
 * `stats` is missing from the order on purpose: it is a thin band of figures tied
 * to the hero above it, not a section you would want between two poster rails.
 * It can be hidden; it does not move.
 */
export const FIXED_SECTIONS: SectionId[] = ["stats"];

export type Density = "comfortable" | "compact";

export interface DashboardPrefs {
  hidden: SectionId[];
  order: SectionId[];
  density: Density;
}

const DEFAULTS: DashboardPrefs = { hidden: [], order: DEFAULT_ORDER, density: "comfortable" };

const KEY = (userId: number | undefined) =>
  userId === undefined ? null : `anitrack-dashboard:${userId}`;

const isSection = (v: unknown): v is SectionId =>
  typeof v === "string" && [...DEFAULT_ORDER, ...FIXED_SECTIONS].includes(v as SectionId);

/**
 * Reads the stored preference, repairing anything that does not describe a
 * dashboard this version can render.
 *
 * A stored order is not trusted to be complete: a release that adds a section
 * would otherwise leave it permanently invisible to everybody who had ever
 * customised anything, because their saved order simply would not mention it.
 * Known ids are kept in the order they were saved, unknown ones dropped, and
 * anything missing appended in its recommended position.
 */
export function readPrefs(userId: number | undefined): DashboardPrefs {
  const key = KEY(userId);
  if (!key) return DEFAULTS;

  let parsed: unknown;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULTS;
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULTS;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULTS;

  const { hidden, order, density } = parsed as Partial<DashboardPrefs>;
  const savedOrder = Array.isArray(order) ? order.filter(isSection) : [];

  return {
    hidden: Array.isArray(hidden) ? hidden.filter(isSection) : [],
    order: [...savedOrder, ...DEFAULT_ORDER.filter((id) => !savedOrder.includes(id))],
    density: density === "compact" ? "compact" : "comfortable",
  };
}

export function useDashboardPrefs() {
  const { data: me } = useMe();
  const userId = me?.id;
  const [prefs, setPrefs] = useState<DashboardPrefs>(() => readPrefs(userId));

  // The dashboard's first render usually beats `/me`, so the stored preference is
  // re-read once the account is known rather than left at the defaults.
  useEffect(() => setPrefs(readPrefs(userId)), [userId]);

  const persist = useCallback(
    (next: DashboardPrefs) => {
      setPrefs(next);
      const key = KEY(userId);
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Private mode, or storage refused. The preference is lost on reload,
        // which is a worse dashboard rather than a broken one.
      }
    },
    [userId],
  );

  const setHidden = useCallback(
    (id: SectionId, hidden: boolean) =>
      persist({
        ...prefs,
        hidden: hidden ? [...new Set([...prefs.hidden, id])] : prefs.hidden.filter((x) => x !== id),
      }),
    [prefs, persist],
  );

  /** Moves a section one place. Clamped, so the ends are simply not moveable. */
  const move = useCallback(
    (id: SectionId, delta: -1 | 1) => {
      const from = prefs.order.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prefs.order.length) return;
      const order = [...prefs.order];
      [order[from], order[to]] = [order[to], order[from]];
      persist({ ...prefs, order });
    },
    [prefs, persist],
  );

  const setDensity = useCallback(
    (density: Density) => persist({ ...prefs, density }),
    [prefs, persist],
  );

  const reset = useCallback(() => {
    persist(DEFAULTS);
    const key = KEY(userId);
    // Removed rather than left holding the defaults, so an account that resets is
    // indistinguishable from one that never customised — including after a release
    // that changes what the recommended arrangement is.
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* nothing to undo */
      }
    }
  }, [persist, userId]);

  return {
    ...prefs,
    isHidden: (id: SectionId) => prefs.hidden.includes(id),
    hide: (id: SectionId) => setHidden(id, true),
    setHidden,
    move,
    setDensity,
    reset,
    /** True when anything differs from the recommended arrangement. */
    customised:
      prefs.hidden.length > 0 ||
      prefs.density !== "comfortable" ||
      prefs.order.join() !== DEFAULT_ORDER.join(),
  };
}
