/**
 * Where to go back to after signing in.
 *
 * Opening a shared link to a title while logged out sent you to `/login` and threw
 * the destination away — you signed in and landed on the dashboard, with the thing
 * somebody sent you nowhere in sight and the URL already replaced in history.
 *
 * The destination now travels with the redirect, which makes it attacker-reachable:
 * anything that decides where a freshly authenticated session lands is a redirect
 * target, and an open one is a phishing primitive. Somebody can hand out a link
 * that signs a person into the real instance and then bounces them to a copy of it
 * asking for the password again. So the value is validated rather than trusted —
 * here, in one function, with the rejections pinned by tests.
 */

/** Where a signed-in session goes when there is nothing better. */
export const DEFAULT_ROUTE = "/";

/**
 * The one shape allowed through: an absolute path on this origin.
 *
 * Everything is rejected unless it is recognised, rather than the other way round.
 * A blocklist of "javascript:", "//" and the rest is a list of the tricks somebody
 * has already thought of; this is a description of the only thing that is wanted.
 */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const path = value.trim();

  // A single leading slash and nothing else. `//host` is protocol-relative and
  // navigates off-origin; the backslash form is the same trick, which some
  // browsers normalise into a slash.
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.startsWith("/\\")) return null;

  // A scheme anywhere in the first segment means this is not a path at all --
  // `javascript:` and `data:` arrive looking like one often enough.
  if (/^\/[^/?#]*:/.test(path)) return null;

  // Control characters and spaces, which are what gets used to smuggle a scheme
  // past a check like the one above.
  if (/[\u0000-\u0020\u007f]/.test(path)) return null;

  // Landing back on the sign-in page is a loop, and the setup wizard is not a
  // destination for somebody who has just signed in.
  const [pathname] = path.split(/[?#]/);
  if (pathname === "/login" || pathname === "/setup") return null;

  return path;
}

/**
 * Where the destination is parked between the redirect and the sign-in.
 *
 * `sessionStorage` rather than the history entry's state, which was the first
 * attempt and does not survive what happens next: a successful sign-in swaps the
 * whole router over to its authenticated routes while the address is still
 * `/login`, and their catch-all redirect fires during that render — before the
 * sign-in page's own navigation can run, and winning the race every time. Parking
 * the value outside React entirely means whoever reaches it first can use it.
 *
 * Per tab, so a destination cannot leak into a window the person opened for
 * something else, and gone when the tab closes.
 */
const KEY = "anitrack-return-to";

/** Remembers where somebody was going. Never throws. */
export function rememberReturnPath(path: string): void {
  const safe = safeReturnPath(path);
  if (!safe) return;
  try {
    sessionStorage.setItem(KEY, safe);
    // A newly remembered destination is not the one already taken.
    consumed = undefined;
  } catch {
    // Private mode, or storage refused outright. Losing the destination costs a
    // trip to the dashboard; it is not worth failing a sign-in over.
  }
}

/**
 * What this page load has already taken. `undefined` means "not yet asked".
 *
 * Reading has to be idempotent within a page load, because React calls the same
 * code twice: StrictMode double-invokes a state initialiser and re-runs an
 * effect, and a plain read-and-clear answers the destination the first time and
 * `null` the second. The second answer is the one that ends up on screen, which
 * is how a correctly stored destination still landed on the dashboard.
 */
let consumed: string | null | undefined;

/**
 * Reads the destination and forgets it in the same breath.
 *
 * Clearing on read rather than after navigating is deliberate: a destination that
 * outlives its use would send the *next* sign-in somewhere nobody asked to go.
 * The value is validated again on the way out — what went into storage and what
 * comes out of it are not the same act, and this is the one that decides where a
 * browser is sent.
 */
export function takeReturnPath(): string | null {
  if (consumed !== undefined) return consumed;

  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    consumed = null;
    return null;
  }
  consumed = safeReturnPath(raw);
  return consumed;
}
