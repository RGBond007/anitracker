import { useTranslation } from "react-i18next";

import { cx } from "../../lib/cx";

/**
 * The id the skip link aims at. Exported rather than written twice, so the link
 * and its target cannot drift apart into a link that goes nowhere.
 */
export const MAIN_CONTENT_ID = "main-content";

/**
 * The first thing in the tab order, and invisible until it is reached.
 *
 * Without it the header is a toll gate: every route change puts the whole nav —
 * five links, a badge, search, the avatar menu — in front of the page someone
 * actually asked for, and a keyboard or switch user pays that toll on every
 * single navigation. Sighted pointer users skip it by looking.
 *
 * Focus is moved by hand rather than left to the fragment in `href`. The href is
 * still there, because it is what makes this a link and what a screen reader
 * announces, but the demo build routes on the hash — following `#main-content`
 * there would be read as a route, not an anchor, and would navigate away from
 * the page it was meant to move within.
 */
export function SkipLink() {
  const { t } = useTranslation();

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={(event) => {
        event.preventDefault();
        // `focus()` scrolls the target into view on its own; asking for it again
        // would only fight the browser over where the top of `main` is.
        document.getElementById(MAIN_CONTENT_ID)?.focus();
      }}
      className={cx(
        // Present in the tab order and in the accessibility tree at all times,
        // taking up no space until someone tabs to it.
        "sr-only",
        // Fixed rather than absolute: it is drawn against the viewport, so it
        // lands in the same corner whether or not the page has been scrolled.
        "focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50",
        // Surface-on-ground in dark, white-on-paper in light, and the global
        // focus ring sits around it in both — it is only ever seen focused.
        "focus:rounded-control focus:border focus:border-control-line focus:bg-surface",
        "focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-text",
      )}
    >
      {t("nav.skipToContent")}
    </a>
  );
}
