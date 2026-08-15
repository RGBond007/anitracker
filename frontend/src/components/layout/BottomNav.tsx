import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { cx } from "../../lib/cx";
import { useFriends } from "../../features/social/useSocial";

/**
 * Phone navigation. Hidden from `sm` up, where the top bar carries the links.
 *
 * Fixed to the bottom because that is where a thumb rests, and because two
 * stacked rows of top navigation were eating ~90px of a 844px screen before any
 * content appeared. `AppShell` pads the page out by the same height so the last
 * row of posters is never trapped underneath.
 */

function Icon({ path, filled = false }: { path: string; filled?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  library: "M4 4h6v16H4zM14 4h6v16h-6z",
  friends: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
};

export function BottomNav() {
  const { t } = useTranslation();
  const { data: friends } = useFriends();
  const pending = friends?.incoming.length ?? 0;

  const items = [
    { to: "/", end: true, label: t("nav.dashboard"), icon: ICONS.home, badge: 0 },
    { to: "/list/current", end: false, label: t("nav.library"), icon: ICONS.library, badge: 0 },
    { to: "/search", end: false, label: t("nav.search"), icon: ICONS.search, badge: 0 },
    { to: "/friends", end: false, label: t("nav.friends"), icon: ICONS.friends, badge: pending },
    { to: "/settings", end: false, label: t("nav.settings"), icon: ICONS.settings, badge: 0 },
  ];

  return (
    <nav
      aria-label={t("nav.primary")}
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur",
        "sm:hidden",
      )}
      // Keeps the row clear of the iPhone home indicator in standalone mode.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  "relative flex h-[56px] flex-col items-center justify-center gap-1 px-0.5",
                  isActive ? "text-stamp-text" : "text-text-dim",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon path={item.icon} filled={isActive && item.to === "/"} />
                  <span className="whitespace-nowrap text-[10px] leading-none">{item.label}</span>
                  {item.badge > 0 && (
                    <span
                      aria-hidden
                      className="font-mono absolute right-[22%] top-1.5 rounded-pill bg-stamp px-1 text-[9px] font-medium leading-[14px] text-ink-950"
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
