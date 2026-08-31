/** What is waiting on you, split by kind because the two are not the same errand. */
export interface Pending {
  /** Friend requests to answer. */
  requests: number;
  /** Recommendations sent to you and not yet opened. */
  recommendations: number;
  total: number;
}

/**
 * Builds the accessible name for the Friends nav item.
 *
 * The visual badge is a number in a gold pill, which works because it is *next to*
 * the word "Friends" and because a number in that position has an obvious meaning.
 * Read aloud, neither of those holds: the mobile badge was `aria-hidden` and its
 * count reached nobody, and the desktop one was announced as a bare "Friends 3" —
 * three of what, exactly.
 *
 * So the count goes into the name of the link itself, and it says what it counts.
 * Splitting requests from recommendations rather than summing them to "3 pending
 * items" costs one clause and answers the question the number raises: a friend
 * waiting on an answer is a different errand from a title someone sent you.
 *
 * `t` is passed in rather than reached for, and this file imports nothing, so the
 * branching can be tested without standing up i18next, a store or a DOM — the
 * hook next door reaches all three, and a test that imports it dies on
 * `localStorage` before it asserts anything.
 */
export function pendingNavLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  base: string,
  { requests, recommendations }: Pick<Pending, "requests" | "recommendations">,
): string {
  // Nothing waiting is the normal state, and "Friends, 0 pending" is noise on
  // every single navigation. The name stays exactly what it was.
  if (requests <= 0 && recommendations <= 0) return base;

  const parts: string[] = [];
  if (requests > 0) parts.push(t("nav.pendingRequests", { count: requests }));
  if (recommendations > 0) parts.push(t("nav.pendingRecommendations", { count: recommendations }));

  return t("nav.withPending", {
    label: base,
    pending: parts.length === 2 ? t("nav.pendingJoin", { first: parts[0], second: parts[1] }) : parts[0],
  });
}
