import { UI_CONTRAST, GROUNDS, isHex, readableInk, readableOn } from "./contrast";

/**
 * Puts the instance's accent into the token layer, where every `stamp` colour
 * reads it.
 *
 * One function rather than a `setProperty` call at each site, because the callers
 * have to agree on what "no accent" means: the startup screen applies a remembered
 * colour before its first paint, and the router applies the real one a moment
 * later. If the second could only ever *set* the property, an instance that has
 * since cleared its accent would keep wearing the remembered one for the rest of
 * the session — so clearing is part of the same job.
 *
 * An empty value is the documented reset (see the instance settings): removing the
 * inline properties hands every colour back to the fallbacks in `tokens.css`.
 *
 * What is set is four values per theme rather than one, because a single colour
 * cannot do the four jobs the accent is asked to do. The submitted colour is kept
 * for decoration — tints, rims, the borders drawn from `--stamp-raw` — and the
 * rest are derived from it:
 *
 * - `--stamp-*`   the fill, moved far enough from the page to read as a bar or a
 *                 dot rather than dissolve into it
 * - `--stamp-ink-*` ink or paper, whichever can actually be read *on* that fill.
 *                 This is the value the components used to hardcode as
 *                 `text-ink-950`, which painted near-black text on a near-black
 *                 button for any dark accent
 * - `--stamp-text-*` the accent as *text* on the page, which needs to clear a
 *                 higher bar than a bar does
 *
 * Both themes are computed and CSS picks between them, so switching theme needs no
 * listener here and cannot leave a stale pair behind.
 */
export function applyAccent(color: string | null | undefined): void {
  const style = document.documentElement.style;

  const PROPS = [
    "--stamp-raw",
    "--stamp-dark",
    "--stamp-light",
    "--stamp-ink-dark",
    "--stamp-ink-light",
    "--stamp-text-dark",
    "--stamp-text-light",
  ];

  // Not a colour we can reason about — including the empty reset, and including
  // anything the API let through that is not a six-digit hex. The stylesheet's
  // own values are always a safe pair, which is more than can be said for a
  // half-applied one.
  if (!color || !isHex(color)) {
    for (const prop of PROPS) style.removeProperty(prop);
    // A non-hex value that is still a colour the browser understands — a named
    // colour from an older `.env` — is honoured as decoration, since nothing
    // derived can be computed from it.
    if (color && !isHex(color)) style.setProperty("--stamp-raw", color);
    return;
  }

  const fillDark = readableOn(color, GROUNDS.dark, UI_CONTRAST);
  const fillLight = readableOn(color, GROUNDS.light, UI_CONTRAST);

  style.setProperty("--stamp-raw", color);
  style.setProperty("--stamp-dark", fillDark);
  style.setProperty("--stamp-light", fillLight);
  style.setProperty("--stamp-ink-dark", readableInk(fillDark).color);
  style.setProperty("--stamp-ink-light", readableInk(fillLight).color);
  style.setProperty("--stamp-text-dark", readableOn(color, GROUNDS.dark));
  style.setProperty("--stamp-text-light", readableOn(color, GROUNDS.light));
}
