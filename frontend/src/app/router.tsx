import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import { useInstance } from "../features/instance/useInstance";
import { useMe } from "../features/auth/useAuth";
import { ChangePasswordPage } from "../pages/ChangePassword";
import { DashboardPage } from "../pages/Dashboard";
import { FriendsPage } from "../pages/Friends";
import { ImportPage } from "../pages/Import";
import { ListViewPage } from "../pages/ListView";
import { LoginPage } from "../pages/Login";
import { MediaDetailPage } from "../pages/MediaDetail";
import { ProfilePage } from "../pages/Profile";
import { SearchPage } from "../pages/Search";
import { SettingsPage } from "../pages/Settings";
import { SetupPage } from "../pages/Setup";

/** No entrance animation anywhere (§6) — a utility app should just be painted. */
export function Router() {
  const instance = useInstance();
  const me = useMe();

  // The instance accent is admin-configurable; feed it into the token layer so
  // every `stamp` usage picks it up without a single component knowing about it.
  useEffect(() => {
    if (instance.data?.accent_color) {
      document.documentElement.style.setProperty("--stamp", instance.data.accent_color);
    }
    if (instance.data?.instance_name) document.title = instance.data.instance_name;
  }, [instance.data]);

  if (instance.isLoading || me.isLoading) return <div className="min-h-dvh" />;

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
        <Route path="*" element={<Navigate to="/login" replace />} />
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
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/u/:username" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/import" element={<ImportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
