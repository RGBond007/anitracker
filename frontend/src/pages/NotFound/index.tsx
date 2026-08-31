import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/ui/Button";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

/**
 * How long an address can be before showing it stops helping.
 *
 * Long enough for any real route in this app several times over, short enough
 * that a pasted essay does not become the page.
 */
const MAX_SHOWN = 120;

/**
 * Whether the address is worth putting on screen.
 *
 * It is the one piece of attacker-controlled text here — anybody can send a link
 * to any path — so it is shown only when it reads as a path somebody could have
 * meant. React escapes it either way, so this is not about markup; it is about
 * not turning the page into a billboard for whatever a stranger put in the URL.
 * A line of text on a page saying "could not be found" is a fine place to write
 * "call this number to fix your account", and that is worth refusing outright.
 */
function showable(pathname: string): boolean {
  if (pathname.length > MAX_SHOWN) return false;
  // Paths, not prose: letters, digits, and the punctuation a route is made of.
  return /^\/[\w\-./~%]*$/.test(pathname);
}

/**
 * What an unknown address gets instead of a silent redirect.
 *
 * Every mistyped or outdated link used to land on the dashboard, which looks
 * exactly like a link that worked — so a stale bookmark, a renamed route or a
 * typo all read as "here is your library" and the person never finds out the
 * thing they clicked is gone.
 */
export function NotFoundPage() {
  const { t } = useTranslation();
  const location = useLocation();
  useDocumentTitle(t("notFound.title"));

  return (
    <div className="wrap py-16">
      <div className="max-w-[520px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stamp-text">
          {t("notFound.kicker")}
        </p>
        <h1 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-[-0.01em]">
          {t("notFound.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-dim">{t("notFound.body")}</p>

        {showable(location.pathname) && (
          <p className="font-mono mt-4 break-all rounded-control border border-line px-3.5 py-2.5 text-[12px] text-text-faint">
            {location.pathname}
          </p>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/">
            <Button variant="primary">{t("nav.dashboard")}</Button>
          </Link>
          <Link to="/list/current">
            <Button>{t("nav.library")}</Button>
          </Link>
          <Link to="/search">
            <Button>{t("nav.search")}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
