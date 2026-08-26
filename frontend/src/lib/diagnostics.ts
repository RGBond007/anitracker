/**
 * The text the crash screen hands over for a bug report.
 *
 * A stack trace is the only thing that makes an unreproducible crash fixable, and
 * asking someone to open the devtools console is asking most people to give up. So
 * the recovery screen shows the trace itself — which means this file has one job
 * beyond formatting: whatever it prints, someone will paste into a public issue
 * tracker without reading it first.
 *
 * Everything here is therefore built to be *shown*. The screen renders exactly the
 * string it copies, so there is no hidden half that only travels to the clipboard,
 * and `redact` runs over the finished report rather than over each field, so a new
 * field cannot be added later that quietly skips it.
 */

/** What the report is built from. Injected rather than read off `window`, so the
 *  redaction rules can be tested against realistic input without a browser. */
export interface CrashFacts {
  error: unknown;
  /** React's "the component tree at the point it threw". Null when unavailable. */
  componentStack?: string | null;
  /** A full href — `window.location.href`. Its query string is never printed. */
  href: string;
  userAgent: string;
  version: string;
  /** ISO 8601. Passed in so a report is reproducible in a test. */
  at: string;
}

/**
 * A bug report that is longer than this is not read, and the useful part of a
 * stack is its first few frames. Truncating also caps the damage a pathological
 * error message — a whole response body stringified into a `message` — can do.
 */
const MAX_REPORT_CHARS = 4_000;

/**
 * Substitutions applied to the finished report, in order.
 *
 * Each rule is here because of something this app actually carries, not as a
 * generic secret-scanner: the session travels as a JWT, the API's error `detail`
 * is echoed into `ApiError.message` and can name a user, and any of it can end up
 * inside a stringified object in a stack frame.
 */
const RULES: readonly [RegExp, string][] = [
  // A query string is where one-time links keep their secret, and where the app's
  // own search terms end up. Neither belongs in a public issue; the path answers
  // "which screen broke", which is the only part that helps.
  [/(https?:\/\/[^\s"'<>]*?)\?[^\s"'<>]*/gi, "$1?[redacted]"],
  // The shape of the access and refresh tokens. Matched before the generic
  // key-value rule so a bare token, named by nothing, is still caught.
  [/\beyJ[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]+){1,2}/g, "[redacted]"],
  // `Authorization: Bearer …`, and the header's other scheme.
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{4,}/gi, "$1 [redacted]"],
  // Anything that names itself a credential, however it is punctuated: a form
  // body, a JSON fragment, a `cookie=` pair, a serialised header.
  [
    /(["']?\b(?:authorization|access[_-]?token|refresh[_-]?token|token|secret|passwd|password|pwd|api[_-]?key|apikey|auth|cookie|session|signature|credential)\b["']?\s*[:=]\s*)(["']?)[^\s,;&"'}\]]+\2/gi,
    "$1[redacted]",
  ],
  // Email addresses. Not a secret, but it is the one identifier this app stores
  // that names a person outside it, and the API says it out loud on a conflict:
  // "a user with this email already exists" is a plausible crash message.
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted]"],
];

/**
 * The backstop for an opaque blob that no rule above named — a base64 payload, a
 * signature, a data: URI inlined into a message.
 *
 * Deliberately narrow. A blanket "long run of characters" rule eats file paths and
 * minified frames, and a report whose stack is entirely `[redacted]` is worse than
 * no report: it teaches people to send screenshots of the console instead. So a
 * run only counts as opaque when it mixes cases and digits the way generated
 * credentials do and prose, paths and identifiers do not. `/` is excluded from the
 * run for the same reason — it is what a path is made of.
 */
const OPAQUE_RUN = /[A-Za-z0-9+_-]{32,}={0,2}/g;

function looksGenerated(run: string): boolean {
  return /[a-z]/.test(run) && /[A-Z]/.test(run) && /\d/.test(run);
}

/** Removes what must never reach an issue tracker. Total, and applied last. */
export function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out.replace(OPAQUE_RUN, (run) => (looksGenerated(run) ? "[redacted]" : run));
}

/**
 * Which screen broke, without the query string.
 *
 * The hash is kept because the Pages demo routes on it — dropping it there would
 * leave every report pointing at `/`. Its own query string goes the same way the
 * document's does.
 */
export function describeRoute(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    // Not a URL the browser would have given us; better a marker than a throw
    // inside the screen whose whole job is to survive a throw.
    return "(unknown)";
  }

  const hash = url.hash.split("?")[0];
  const route = `${url.pathname}${hash}`;
  return url.search ? `${route} (query omitted)` : route;
}

/** `name: message` for anything that was thrown, including what was not an Error. */
function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return `Non-error thrown: ${error}`;
  // A `throw {…}` still has to produce a report, and the object it threw can be
  // circular — `JSON.stringify` is the second thing that would crash the screen.
  try {
    return `Non-error thrown: ${JSON.stringify(error)}`;
  } catch {
    return `Non-error thrown: ${String(error)}`;
  }
}

/**
 * The whole report, as both the screen and the clipboard see it.
 *
 * `error.stack` already carries the `name: message` line in every engine that has
 * a stack at all, so it is printed instead of the summary rather than after it —
 * a report that says the same sentence twice reads as a bug in the reporter.
 */
export function buildCrashReport(facts: CrashFacts): string {
  const { error, componentStack, href, userAgent, version, at } = facts;
  const summary = describeError(error);
  const stack = error instanceof Error && error.stack ? error.stack : summary;

  const sections = [
    `AniTracker ${version}`,
    at,
    describeRoute(href),
    userAgent,
    "",
    stack.trimEnd(),
  ];

  if (componentStack?.trim()) {
    sections.push("", "Component stack:", componentStack.trim());
  }

  const report = redact(sections.join("\n"));
  return report.length > MAX_REPORT_CHARS
    ? `${report.slice(0, MAX_REPORT_CHARS)}\n… (truncated)`
    : report;
}
