import { useTranslation } from "react-i18next";

import type { Season, TitleLanguage } from "../../lib/api-client";
import { seasonSubtitle } from "../../lib/franchise";
import { displayTitle } from "../../lib/titles";
import { useStatusLabel } from "./statusLabels";

/**
 * How a member of a series is named, badged and described.
 *
 * One place, because the carousel, the phone chips, the page heading and the action
 * beside it must all call season 3 the same thing — and because a movie has to read
 * as a movie in every one of them rather than as "Season null".
 */
export function useSeasonLabels() {
  const { t } = useTranslation();
  const statusLabel = useStatusLabel();

  /** The short badge printed on the artwork: `S3`, `MOVIE`, `OVA`, `SP`. */
  const badge = (season: Season): string =>
    season.kind === "season" && season.season_number != null
      ? t("season.number", { n: season.season_number })
      : t(`season.kindShort_${season.kind}`);

  /** The full name of what this is: "Season 3", "Movie", or its own subtitle. */
  const name = (season: Season, seriesTitle: string, lang: TitleLanguage): string => {
    const subtitle = seasonSubtitle(displayTitle(season.media, lang), seriesTitle);
    if (subtitle) return subtitle;
    if (season.kind === "season" && season.season_number != null) {
      return t("season.short", { n: season.season_number });
    }
    return t(`season.kind_${season.kind}`);
  };

  /**
   * Progress and status in one line. An untracked member reads "Not started" — the
   * sixth status, which exists in the UI without existing in the database: a season
   * you have never touched has no entry to hold a status on.
   */
  const statusLine = (season: Season): string => {
    const { entry, media } = season;
    const total = media.total_units;
    if (!entry) {
      return total
        ? `${t("season.notStarted")} · ${t(
            media.type === "manga" ? "season.chapters" : "season.episodes",
            { n: total },
          )}`
        : t("season.notStarted");
    }
    const progress = total ? `${entry.progress}/${total}` : `${entry.progress}`;
    return `${progress} · ${statusLabel(entry.status, media.type)}`;
  };

  return { badge, name, statusLine };
}
