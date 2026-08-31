import { ApiError } from "./api-client";

/**
 * What to show someone when a request fails.
 *
 * Two things were wrong with printing `String(error)`, which is what every form in
 * the app did. `ApiError` sets `name = "ApiError"`, and `String()` on an Error
 * yields `"<name>: <message>"` — so a failed save told the user, in a red line
 * under the field, "ApiError: Not Found". And the message half is the server's
 * `detail`, which is written in English in the Python source and stays English
 * however the interface is set.
 *
 * So the status decides the sentence, and the sentence comes from the locale. The
 * server's own text is never shown: it is a developer's string, and there is no
 * translation of it to reach for.
 *
 * Returned as a key rather than a string because this file has no `t` — the hook
 * next door has it, and keeping the mapping pure means it can be tested without
 * standing up i18next.
 */
export function errorKey(error: unknown): string {
  if (!error) return "";

  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
      case 422:
        return "error.badRequest";
      case 401:
        return "error.unauthorized";
      case 403:
        return "error.forbidden";
      case 404:
        return "error.notFound";
      case 409:
        return "error.conflict";
      case 413:
        return "error.tooLarge";
      case 429:
        return "error.rateLimited";
      default:
        return error.status >= 500 ? "error.server" : "error.generic";
    }
  }

  // `fetch` rejects with a TypeError when it cannot reach the host at all, which
  // on a self-hosted instance usually means the container is down or the laptop
  // is off the network — worth saying, because it is not the app's fault and the
  // fix is somewhere else entirely.
  if (error instanceof TypeError) return "error.offline";

  return "error.generic";
}
