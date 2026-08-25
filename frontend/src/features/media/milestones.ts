/**
 * What a progress count means, beyond the number itself.
 *
 * Logging an episode is the most repeated action in the app, and a count that
 * only goes up says nothing about *where* you are. A milestone is the reading of
 * that count a viewer would give out loud — "halfway", "finale next" — derived
 * from the entry alone. Nothing is stored: there is no episode history table, and
 * a milestone that needs one would be a schema for a caption.
 *
 * Deliberately few. §6 rules gimmicks out, so this is a label on a real position
 * in a season, never a badge, a streak or a score.
 */

/** An anime cour is 12 or 13 weeks; 12 is the drumbeat a long run is felt in. */
const COUR = 12;

/** Below this a season is a countable list of episodes; above it, a bar. */
export const LEDGER_MAX = 26;

/** Half of a three-episode OVA is not a milestone — it is a rounding error. */
const MIN_FOR_HALF = 8;

export type MilestoneKind = "first" | "cour" | "half" | "last" | "done";

export interface Milestone {
  kind: MilestoneKind;
  /** Which cour just closed, for `cour`. */
  count?: number;
}

/**
 * The milestone *standing* at this count, not the one just crossed — so a page
 * loaded at episode 12 of 24 reads "Halfway" the same as it would a second after
 * the click that got there.
 *
 * Ordered by what a viewer would say first: finishing outranks the last episode,
 * which outranks the midpoint, which outranks a cour break.
 */
export function milestoneAt(
  progress: number,
  total: number | null,
  isManga: boolean,
): Milestone | null {
  if (progress <= 0) return null;

  if (total != null && progress >= total) return { kind: "done" };
  if (total != null && total - progress === 1) return { kind: "last" };

  if (total != null && total >= MIN_FOR_HALF && progress === Math.ceil(total / 2)) {
    return { kind: "half" };
  }

  // Cours are how anime is scheduled and talked about; a manga has no equivalent,
  // so a chapter count gets no invented rhythm.
  if (!isManga && progress % COUR === 0 && (total == null || total > COUR + 1)) {
    return { kind: "cour", count: progress / COUR };
  }

  if (progress === 1) return { kind: "first" };

  return null;
}

/** The i18n key for a milestone, picking the manga wording where one exists. */
export function milestoneKey(milestone: Milestone, isManga: boolean): string {
  const { kind } = milestone;
  if (isManga && (kind === "first" || kind === "last")) {
    return `log.milestone.${kind}Manga`;
  }
  return `log.milestone.${kind}`;
}
