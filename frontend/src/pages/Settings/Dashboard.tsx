import { useTranslation } from "react-i18next";

import {
  DEFAULT_ORDER,
  useDashboardPrefs,
  type Density,
  type SectionId,
} from "../../features/dashboard/useDashboardPrefs";
import { Button } from "../../components/ui/Button";
import { Segmented } from "../../components/ui/Input";
import { Icon, ICONS } from "../../components/ui/Icon";
import { SectionHeading, SettingRow, SettingRows } from "./parts";

/** Every optional section, and the copy each is known by elsewhere in the app. */
const LABELS: Record<SectionId, string> = {
  stats: "dashboard.statsLabel",
  tonight: "recap.heading",
  schedule: "schedule.heading",
  inProgress: "dashboard.alsoInProgress",
  recent: "dashboard.recent",
  friends: "dashboard.friendsFinished",
};

/**
 * What the dashboard shows, in what order, and how tightly.
 *
 * It lives in settings rather than on the dashboard itself: the point of the whole
 * exercise was that the page carries too much, and a customisation panel bolted to
 * the top of it would be one more thing to scroll past. The inline hide control on
 * each section is the quick path; this is where it is undone and rearranged.
 *
 * Nothing here is mandatory. An account that never opens it gets the curated
 * arrangement, and nothing is stored until something is changed.
 */
export function DashboardSection() {
  const { t } = useTranslation();
  const { order, density, isHidden, setHidden, move, setDensity, reset, customised } =
    useDashboardPrefs();

  return (
    <section>
      <SectionHeading title={t("settings.dashboardTitle")} description={t("settings.dashboardHint")} />

      <SettingRows>
        <SettingRow label={t("settings.density")} description={t("settings.densityHint")}>
          <Segmented
            name="dashboard-density"
            value={density}
            onChange={(value) => setDensity(value as Density)}
            options={[
              { value: "comfortable", label: t("settings.densityComfortable") },
              { value: "compact", label: t("settings.densityCompact") },
            ]}
          />
        </SettingRow>
      </SettingRows>

      <h3 className="mt-8 text-sm font-medium text-text">{t("settings.sections")}</h3>
      <p className="mt-1.5 max-w-prose text-[12.5px] leading-relaxed text-text-dim">
        {t("settings.sectionsHint")}
      </p>

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {/* `stats` first and outside the reorderable list: it is a band of figures
            tied to the hero, and nobody wants it between two poster rails. */}
        {(["stats", ...order] as SectionId[]).map((id, index) => {
          const movable = id !== "stats";
          const position = index - 1;
          return (
            <li key={id} className="flex items-center gap-3 py-3">
              {/* The whole row is the target, not just the 16px box: at 20px tall this
                  was the one control on the page a thumb could miss. */}
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 pointer-coarse:min-h-[44px]">
                <input
                  type="checkbox"
                  checked={!isHidden(id)}
                  onChange={(e) => setHidden(id, !e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-stamp"
                />
                <span className="truncate text-sm text-text">{t(LABELS[id])}</span>
              </label>

              <div className="flex shrink-0 items-center gap-1">
                <MoveButton
                  label={t("settings.moveUp", { name: t(LABELS[id]) })}
                  disabled={!movable || position <= 0}
                  onClick={() => move(id, -1)}
                  up
                />
                <MoveButton
                  label={t("settings.moveDown", { name: t(LABELS[id]) })}
                  disabled={!movable || position >= order.length - 1}
                  onClick={() => move(id, 1)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="button" disabled={!customised} onClick={reset}>
          {t("settings.resetDashboard")}
        </Button>
        {!customised && (
          <span className="text-xs text-text-faint">{t("settings.dashboardDefault")}</span>
        )}
      </div>
    </section>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  up = false,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  up?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-control text-text-dim transition-colors hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-30 pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]"
    >
      <Icon path={ICONS.chevronDown} size={15} className={up ? "rotate-180" : undefined} />
    </button>
  );
}

/** Exported for the tests: the arrangement a reset returns to. */
export { DEFAULT_ORDER };
