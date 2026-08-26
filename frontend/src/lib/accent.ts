/**
 * Puts the instance's accent into the token layer, where every `stamp` colour
 * reads it. One function rather than a `setProperty` call at each site, because
 * the two callers have to agree on what "no accent" means: the startup screen
 * applies a remembered colour before its first paint, and the router applies the
 * real one a moment later. If the second could only ever *set* the property, an
 * instance that has since cleared its accent would keep wearing the remembered
 * one for the rest of the session — so clearing is part of the same job.
 *
 * An empty value is the documented reset (see the instance settings): removing
 * the inline property hands the colour back to `--stamp` in the stylesheet.
 * Anything else is passed through untouched, which is what the router already
 * did — the accent can come from `.env` as well as the settings form, and the
 * browser ignores a value it cannot parse.
 */
export function applyAccent(color: string | null | undefined): void {
  const style = document.documentElement.style;
  if (color) style.setProperty("--stamp", color);
  else style.removeProperty("--stamp");
}
