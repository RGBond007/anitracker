import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import { StartupScreen } from "../components/layout/StartupScreen";
import { useInstance } from "../features/instance/useInstance";
import { useMe } from "../features/auth/useAuth";
import { applyAccent } from "../lib/accent";
import { cacheBrand } from "../lib/brandCache";
import { ChangePasswordPage } from "../pages/ChangePassword";
import { DashboardPage } from "../pages/Dashboard";
import { FriendsPage } from "../pages/Friends";
import { ImportPage } from "../pages/Import";
import { JournalPage } from "../pages/Journal";
import { ListViewPage } from "../pages/ListView";
import { LoginPage } from "../pages/Login";
import { MediaDetailPage } from "../pages/MediaDetail";
import { ProfilePage } from "../pages/Profile";
import { SearchPage } from "../pages/Search";
import { ShelfPage } from "../pages/Shelf";
import { NotFoundPage } from "../pages/NotFound";
import { SettingsPage } from "../pages/Settings";
import { SetupPage } from "../pages/Setup";
import { DEFAULT_ROUTE, rememberReturnPath, takeReturnPath } from "../lib/returnTo";

/**
 * Sends an unauthenticated visitor to sign in, remembering where they were going.
 *
 * The destination rides in the history entry's state rather than in the URL. A
 * `?next=` would be visible, editable and shareable — three ways for somebody
 * else to choose where a fresh session lands — and it would survive being copied
 * out of the address bar and handed to someone. State goes no further than this
 * tab and disappears on its own once it has been used.
 *
 * `replace`, so the back button from the sign-in page does not walk into the
 * protected route that just bounced them.
 */
function RedirectToLogin() {
  const location = useLocation();
  // Rebuilt rather than passed whole: the router's `location` object carries a
  // `key` and a `state` of its own, and only the address is wanted here.
  const from = `${location.pathname}${location.search}${location.hash}`;
  rememberReturnPath(from);
  return <Navigate to="/login" replace />;
}

/**
 * Where a newly authenticated session actually lands.
 *
 * This is the authenticated tree's catch-all, which an address like `/login`
 * falls into the moment signing in succeeds — the router swaps trees while the
 * address has not moved yet. Sending it blindly to the dashboard is what threw
 * away a shared link: somebody opened a title, was bounced to sign in, and
 * arrived at the dashboard with no sign of what they had clicked.
 *
 * Also the landing place for a genuinely unknown address, which has nothing
 * stored and goes to the dashboard as before.
 */
/**
 * The addresses a session can be sitting on at the moment it becomes authenticated.
 *
 * Signing in does not move the browser: the router swaps trees while the address
 * is still the sign-in page, and this catch-all is what that lands in. Those two
 * are a landing; anything else reaching the catch-all is an address that matches
 * nothing, which is a different thing entirely and must not be redirected away.
 */
const POST_AUTH_PATHS = new Set(["/login", "/setup"]);

function AfterAuth() {
  const location = useLocation();

  /**
   * A remembered destination is only ever consulted here, and only when this is
   * genuinely a post-sign-in landing.
   *
   * The narrowing is not cosmetic. `takeReturnPath` answers the same value for
   * the rest of the page load, so asking it from an unknown address — after a
   * sign-in has already used one — would answer with that spent destination and
   * silently send somebody back to a page they had already been sent to, instead
   * of telling them their link is broken.
   *
   * Read once at mount, because it clears as it reads.
   */
  const [to] = useState(() =>
    POST_AUTH_PATHS.has(location.pathname) ? (takeReturnPath() ?? DEFAULT_ROUTE) : null,
  );

  if (to) return <Navigate to={to} replace />;
  return <NotFoundPage />;
}

/** No entrance animation anywhere (§6) — a utility app should just be painted. */
export function Router() {
  const instance = useInstance();
  const me = useMe();

  // The instance accent is admin-configurable; feed it into the token layer so
  // every `stamp` usage picks it up without a single component knowing about it.
  // The served value is the authority — including when it is empty, which has to
  // clear the accent the startup screen applied from the last load rather than
  // leave the instance wearing a colour it no longer has.
  useEffect(() => {
    if (!instance.data) return;
    applyAccent(instance.data.accent_color);
    // The document title is not set here any more: each page names itself through
    // `useDocumentTitle`, which appends this instance's name. Setting it from both
    // places made the winner depend on which effect happened to run last.
    // Remembered so the *next* cold start can paint this instance's own brand
    // while `/instance` is still in flight, instead of the built-in one.
    cacheBrand(instance.data);
  }, [instance.data]);

  // Not a blank page: on a slow instance this is the only thing on screen for
  // long enough that an empty one reads as a broken deployment.
  if (instance.isLoading || me.isLoading) return <StartupScreen />;

  // A fresh instance goes straight to the wizard; there is no account to log into.
  if (instance.data && !instance.data.setup_complete) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  if (!me.data) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<RedirectToLogin />} />
      </Routes>
    );
  }

  // An account still on its admin-issued password gets one screen and no shell.
  // The API refuses everything else, so routing anywhere would only show errors.
  if (me.data.must_change_password) {
    return (
      <Routes>
        <Route path="*" element={<ChangePasswordPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/media/:provider/:id" element={<MediaDetailPage />} />
        <Route path="/list/:status" element={<ListViewPage />} />
        <Route path="/shelf/:id" element={<ShelfPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/u/:username" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/import" element={<ImportPage />} />
        {/* Inside the shell, not beside it: somebody who lands on a dead address
            should keep the navigation that gets them out of it, and the not-found
            page needs the same header, footer and skip-link target as every other
            page. The post-sign-in redirect this also serves renders nothing, so
            being wrapped costs it nothing. */}
        <Route path="*" element={<AfterAuth />} />
      </Route>
    </Routes>
  );
}
