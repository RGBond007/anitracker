/**
 * Whether to draw the bundled AniTracker artwork or just the instance's name.
 *
 * This existed three times, written slightly differently each time, and the copies
 * drifted: the header's read `name === "AniTracker" || name === "AniTracker"` —
 * the same string twice, where the second was meant to be the shorter spelling —
 * so an instance called "AniTrack" got the logo on the login screen and a blank
 * gold square in the header. One exported predicate, so the two cannot disagree
 * again: there is only one comparison left to get wrong.
 */

/**
 * Names that mean "this instance never set one". Both spellings are here because
 * the project was renamed and existing `.env` files still carry the old one --
 * an operator who never touched `INSTANCE_NAME` should not lose the branding to a
 * rename they were not part of.
 */
export const BUILT_IN_BRAND_NAMES = ["AniTracker", "AniTrack"] as const;

/** What the app calls itself before the server has answered, and in the setup form. */
export const DEFAULT_INSTANCE_NAME = "AniTracker";

/**
 * True when the bundled logo should be drawn instead of the instance's own name.
 *
 * A custom logo always wins: setting one is an explicit statement that this
 * instance has its own identity, whatever it happens to be called.
 */
export function usesBuiltInBrand(instanceName: string, logoUrl?: string): boolean {
  if (logoUrl) return false;
  return (BUILT_IN_BRAND_NAMES as readonly string[]).includes(instanceName);
}
