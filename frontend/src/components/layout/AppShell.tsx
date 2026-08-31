import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useInstance } from "../../features/instance/useInstance";
import { DemoBanner } from "../../demo/DemoBanner";
import { BottomNav } from "./BottomNav";
import { movesFocusToMain } from "./routeFocus";
import { MAIN_CONTENT_ID, SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";

export function AppShell() {
  const { t } = useTranslation();
  const { data: instance } = useInstance();
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const lastPathname = useRef(pathname);

  /**
   * Hand focus to the new page after a navigation.
   *
   * The skip link only helps on the tab pass that starts at the top of the
   * document. Follow a nav link and focus stays on the link that was pressed,
   * with the rest of the header still ahead of the content and the skip link now
   * *behind* focus, reachable only by shift-tabbing back — measured at eight tab
   * stops between the "Journal" link and the first control on the journal page.
   * That is the toll the skip link exists to remove, arriving again on every
   * in-app navigation.
   *
   * Two things are deliberately left alone. The first render does not move
   * anything, or a fresh load would land past the skip link before anyone could
   * reach it — the ref starts at the current path, so a mount is never a change.
   * And a REPLACE is a page rewriting its own address rather than a new
   * destination: switching season on a title does exactly that, and pulling focus
   * to the top of `main` would take the keyboard out of the switcher still under
   * the user's hand.
   */
  useEffect(() => {
    const moves = movesFocusToMain(lastPathname.current, pathname, navigationType);
    lastPathname.current = pathname;
    if (moves) document.getElementById(MAIN_CONTENT_ID)?.focus();
  }, [pathname, navigationType]);

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(56px+env(safe-area-inset-bottom))] sm:pb-0">
      {/* First in the DOM, so it is first in the tab order on every route the
          shell wraps — which is every route behind a session. */}
      <SkipLink />
      <TopBar />
      <DemoBanner />
      {/* `tabIndex={-1}` is what lets the skip link land here: a region is not
          focusable on its own, and without it the link moves nothing.

          The outline goes with it. `main` runs the full width of the viewport, so
          the global focus ring draws as two gold rules across the page with its
          left and right edges off-screen — it reads as a decorative border rather
          than as "focus is here". Suppressing it costs nothing under WCAG 2.4.7,
          which covers components in the tab sequence; `tabIndex={-1}` is exactly
          the opposite of that, a target reachable only on purpose. Everything a
          Tab can actually stop on keeps its ring, the skip link most of all. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none focus-visible:shadow-none">
        <Outlet />
      </main>
      <footer className="wrap">
        <div className="font-mono flex flex-wrap justify-between gap-2 border-t border-line py-[26px] text-[11px] text-text-faint">
          <span>{t("footer.tagline", { name: instance?.instance_name ?? "AniTracker" })}</span>
          <span>v{instance?.version ?? "1.0.0"}</span>
        </div>
      </footer>
      <BottomNav />
    </div>
  );
}
