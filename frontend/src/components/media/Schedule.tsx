import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api, type AiringEpisode } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";
import { useUiStore } from "../../stores/uiStore";
import { displayTitle } from "../../lib/titles";
import { cx } from "../../lib/cx";
import { CoverImage } from "./CoverImage";
import { mediaHref } from "./Poster";

export function useSchedule() {
  return useQuery({
    queryKey: queryKeys.schedule,
    queryFn: api.schedule,
    // Broadcast times barely move, and the server caches them for half an hour
    // anyway — refetching on every dashboard visit would be pure waste.
    staleTime: 15 * 60 * 1000,
  });
}

/** "Today", "Tomorrow", then the weekday — a date is harder to read at a glance. */
function useDayLabel() {
  const { t, i18n } = useTranslation();
  return (when: Date): string => {
    const today = new Date();
    const days = Math.round(
      (new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
        86_400_000,
    );
    if (days <= 0) return t("schedule.today");
    if (days === 1) return t("schedule.tomorrow");
    return when.toLocaleDateString(i18n.language, { weekday: "long" });
  };
}

/**
 * The week ahead for what you are watching.
 *
 * Only anime that are still broadcasting appear here, so on a list of finished
 * shows the whole section is absent rather than empty — which is the honest
 * result, not a failure.
 */
export function Schedule({ items }: { items: AiringEpisode[] }) {
  const { t, i18n } = useTranslation();
  const lang = useUiStore((s) => s.titleLanguage);
  const dayLabel = useDayLabel();

  return (
    <div className="rail flex gap-3 overflow-x-auto pb-1.5">
      {items.map((item) => {
        const when = new Date(item.airing_at);
        // `episode - 1` is what will exist once it airs; more than that unwatched
        // means the user is behind, which is the useful thing to surface.
        const behind = Math.max(0, item.episode - 1 - item.progress);
        return (
          <Link
            key={`${item.media.provider_id}-${item.episode}`}
            to={mediaHref(item.media)}
            className={cx(
              "group flex w-[248px] shrink-0 items-center gap-3 rounded-control",
              "border border-line bg-surface p-2.5 transition-colors hover:border-control-line",
            )}
          >
            <CoverImage
              media={item.media}
              lang={lang}
              className="h-16 w-[44px] shrink-0 rounded-[4px]"
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-stamp-text">
                {dayLabel(when)} ·{" "}
                {when.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="font-display mt-0.5 line-clamp-2 text-[13px] font-semibold leading-[1.3] group-hover:text-stamp-text">
                {displayTitle(item.media, lang)}
              </p>
              <p className="tabular mt-0.5 text-[11px] text-text-faint">
                {t("schedule.episode", { n: item.episode })}
                {behind > 0 && ` · ${t("schedule.behind", { count: behind })}`}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
