import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useInstance } from "../../features/instance/useInstance";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

export function AppShell() {
  const { t } = useTranslation();
  const { data: instance } = useInstance();

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(56px+env(safe-area-inset-bottom))] sm:pb-0">
      <TopBar />
      <main className="flex-1">
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
