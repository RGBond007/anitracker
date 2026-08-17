import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Season, Series, TitleLanguage } from "../../lib/api-client";
import { useSetCurrentSeason } from "../../features/media/useSeasons";
import { cx } from "../../lib/cx";
import { Button } from "../ui/Button";
import { CoverImage } from "./CoverImage";
import { useSeasonLabels } from "./seasonLabels";

/** Remembered per member, so a declined offer stays declined across reloads. */
const DISMISS_KEY = "anitrack-season-prompt-declined";

function readDeclined(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** The member that follows `season` in release order — the next thing to watch. */
function nextAfter(series: Series, season: Season): Season | null {
  const index = series.seasons.findIndex((s) => s.media.provider_id === season.media.provider_id);
  if (index < 0) return null;
  const rest = series.seasons.slice(index + 1);
  // A season is the natural continuation; an OVA is only offered when there is no
  // season left to offer, so finishing season 2 never suggests a recap special.
  return rest.find((s) => s.kind === "season") ?? rest[0] ?? null;
}

function isFinished(season: Season): boolean {
  const total = season.media.total_units;
  return Boolean(season.entry && total && season.entry.progress >= total);
}

/**
 * What the user can do about the season they are looking at.
 *
 * The whole point of this block is that nothing here happens on its own. Browsing to
 * season 1 does not un-watch season 3, and finishing a season does not silently move
 * anyone forward: it offers, and waits. The offer is a panel rather than a toast so
 * it sits in the page instead of covering the carousel it refers to.
 */
export function SeasonActions({
  series,
  viewed,
  lang,
  onView,
}: {
  series: Series;
  viewed: Season;
  lang: TitleLanguage;
  onView: (season: Season) => void;
}) {
  const { t } = useTranslation();
  const { name } = useSeasonLabels();
  const setCurrent = useSetCurrentSeason();
  const [declined, setDeclined] = useState(readDeclined);

  const current = series.seasons.find((s) => s.is_current);
  const isViewingCurrent = viewed.is_current;
  const next = nextAfter(series, viewed);
  const viewedName = name(viewed, series.title, lang);

  const decline = (providerId: string) => {
    const kept = [...new Set([...declined, providerId])].slice(-50);
    setDeclined(kept);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(kept));
    } catch {
      /* private mode: the offer simply comes back next time */
    }
  };

  const move = (target: Season, options: { start?: boolean; complete?: boolean } = {}) =>
    setCurrent.mutate(
      {
        root: series.root_provider_id,
        provider_id: target.media.provider_id,
        start: options.start,
        complete_provider_id: options.complete ? viewed.media.provider_id : undefined,
      },
      { onSuccess: () => onView(target) },
    );

  // --- you finished this one; carry on? ---
  if (
    isViewingCurrent &&
    isFinished(viewed) &&
    next &&
    !declined.includes(viewed.media.provider_id)
  ) {
    return (
      <section
        className="flex items-center gap-3 rounded-control border border-stamp/40 bg-surface p-3"
        aria-label={t("season.finishedHeading", { name: viewedName })}
      >
        <CoverImage
          media={next.media}
          lang={lang}
          className="hidden h-[64px] w-[43px] shrink-0 rounded-[5px] sm:block"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[13px] font-bold leading-tight">
            {t("season.finishedHeading", { name: viewedName })}
          </p>
          <p className="mt-0.5 text-[12px] text-text-dim">
            {t("season.finishedBody", { name: name(next, series.title, lang) })}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
          <Button
            variant="stamp"
            className="px-3 py-2 text-[12.5px]"
            disabled={setCurrent.isPending}
            onClick={() => move(next, { start: true, complete: true })}
          >
            {t("season.startNamed", { name: name(next, series.title, lang) })}
          </Button>
          <Button
            variant="quiet"
            className="px-2 py-2 text-[12.5px]"
            onClick={() => decline(viewed.media.provider_id)}
          >
            {t("season.notNow")}
          </Button>
        </div>
      </section>
    );
  }

  // --- looking at the season you are on ---
  if (isViewingCurrent) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] font-medium text-stamp-text">
        <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-stamp" />
        {t("season.currentBadge")}
      </p>
    );
  }

  // --- looking at another season: offer to move, do not move ---
  const isUntracked = viewed.entry === null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        variant="primary"
        className="px-4 py-2.5 text-[13px]"
        disabled={setCurrent.isPending}
        onClick={() => move(viewed, { start: isUntracked })}
      >
        {isUntracked
          ? t("season.startNamed", { name: viewedName })
          : t("season.setAsCurrent")}
      </Button>

      {current && (
        <button
          type="button"
          onClick={() => onView(current)}
          className={cx(
            "inline-flex items-center gap-1.5 text-[12.5px] text-text-dim transition-colors",
            "hover:text-text",
          )}
        >
          <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-stamp" />
          {t("season.stillOn", { name: name(current, series.title, lang) })}
        </button>
      )}
    </div>
  );
}
