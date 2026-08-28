/**
 * The three kinds of navigation, as their own union rather than react-router's
 * `NavigationType`. That is a string enum, and a string enum cannot be written
 * as a literal — typing the parameter with it would force every case below to be
 * spelled `NavigationType.Push`, which is a worse way to read a table of them.
 */
export type Navigation = "POP" | "PUSH" | "REPLACE";

/**
 * Whether a navigation should hand focus to the main content.
 *
 * Its own function because the interesting cases cannot be reached from the UI:
 * the season switcher is the only REPLACE in the app, and it needs a title with
 * a season chain, which the static demo has no fixtures for. Left inline in the
 * shell's effect, the rule would be reasoned about and never actually checked.
 */
export function movesFocusToMain(
  previousPathname: string,
  nextPathname: string,
  navigationType: Navigation,
): boolean {
  // A mount, or a render that changed something other than the address. Moving
  // focus on the first paint would land past the skip link before anyone could
  // reach it, which is the opposite of the point.
  if (previousPathname === nextPathname) return false;

  // A page rewriting its own address rather than going somewhere new. Switching
  // season on a title does exactly that — same screen, same controls, one of
  // which the user still has their hand on.
  return navigationType !== "REPLACE";
}
