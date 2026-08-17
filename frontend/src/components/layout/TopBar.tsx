import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { cx } from "../../lib/cx";
import { useInstance } from "../../features/instance/useInstance";
import { useLogout, useMe } from "../../features/auth/useAuth";
import { useFriends } from "../../features/social/useSocial";
import { IconButton } from "../ui/Button";

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** Small count beside a nav item. Never shown at zero. */
function Badge({ count }: { count: number }) {
  return (
    <span className="font-mono ml-1.5 rounded-pill bg-stamp px-1.5 py-0.5 text-[10px] font-medium text-ink-950">
      {count}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    // Anchors, so the coarse-pointer button rule in index.css misses them; a
    // 20px-tall nav link is a miss on a phone.
    "inline-flex items-center text-[13.5px] transition-colors pointer-coarse:min-h-[44px]",
    isActive ? "text-text" : "text-text-dim hover:text-text",
  );

export function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: instance } = useInstance();
  const { data: user } = useMe();
  const logout = useLogout();

  // Incoming requests are the one thing in the app that waits on you, so the
  // count rides the nav rather than only existing on the page itself.
  const { data: friends } = useFriends();
  const pending = friends?.incoming.length ?? 0;
  const instanceName = instance?.instance_name ?? "AniTracker";
  const usesDefaultBrand =
    !instance?.logo_url && (instanceName === "AniTracker" || instanceName === "AniTracker");

  const links = [
    { to: "/", label: t("nav.dashboard"), end: true, badge: 0 },
    { to: "/list/current", label: t("nav.library"), end: false, badge: 0 },
    { to: "/friends", label: t("nav.friends"), end: false, badge: pending },
    { to: "/import", label: t("nav.import"), end: false, badge: 0 },
  ];

  return (
    <header>
      <div className="wrap flex items-center justify-between gap-6 py-5">
        <NavLink to="/" className="flex shrink-0 items-center gap-[9px] pointer-coarse:min-h-[44px]">
          {usesDefaultBrand ? (
            <>
              {/* The mark is 8:3, so height drives the width: h-11 is ~117px, still
                  inside the max-width guard. Held back a step on a phone, where the
                  bar also carries the search, logout and account controls. */}
              <img
                src="/logo.png"
                alt="AniTracker"
                className="brand-dark-only h-9 w-auto max-w-[150px] object-contain sm:h-11"
              />
              {/* Light mode draws the same brand as icon + wordmark, so it grows in
                  step — otherwise switching theme changes the header's weight. */}
              <span className="brand-light-only brand-light-lockup items-center gap-[9px]">
                <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-[7px] sm:h-8 sm:w-8" />
                <span className="font-display text-[16px] font-bold tracking-[0.02em] sm:text-[18px]">
                  {instanceName.toUpperCase()}
                </span>
              </span>
            </>
          ) : instance?.logo_url ? (
            <img src={instance.logo_url} alt="" className="h-6 w-6 rounded-[6px]" />
          ) : (
            <span aria-hidden className="h-6 w-6 rounded-[6px] bg-stamp" />
          )}
          {!usesDefaultBrand && (
            <span className="font-display text-[15px] font-bold tracking-[0.02em]">
              {instanceName.toUpperCase()}
            </span>
          )}
        </NavLink>

        <nav className="hidden gap-[30px] sm:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
              {l.badge > 0 && <Badge count={l.badge} />}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-[18px]">
          {/* Both actions are affordances, not permanent controls — a search field and
              a "Log out" label were eating the bar and crowding the centre nav. */}
          <div className="flex items-center gap-0.5">
            <IconButton label={t("search.label")} onClick={() => navigate("/search")}>
              <SearchIcon />
            </IconButton>
            <IconButton label={t("nav.logout")} onClick={() => logout.mutate()}>
              <LogoutIcon />
            </IconButton>
          </div>

          <NavLink
            to="/settings"
            aria-label={t("nav.settings")}
            className="font-mono flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium text-ink-950 transition hover:brightness-110 pointer-coarse:h-11 pointer-coarse:w-11 pointer-coarse:text-[13px]"
            style={{ background: "linear-gradient(135deg, var(--stamp), #8a6e1c)" }}
          >
            {initials(user?.username ?? "?")}
          </NavLink>
        </div>
      </div>

    </header>
  );
}
