import { useTranslation } from "react-i18next";

import type { Season, TitleLanguage } from "../../lib/api-client";
import { cx } from "../../lib/cx";
import { seasonSubtitle } from "../../lib/franchise";
import { displayTitle } from "../../lib/titles";
import { CoverImage } from "./CoverImage";
import { useStatusLabel } from "./statusLabels";

/**
 * The season picker on a title's page.
 *
 * Every season is shown with its own artwork, count and progress, because that is
 * the thing being chosen between — a list of numbers would make the user remember
 * which cover belongs to which season. The one being viewed carries a gold ring and
 * full contrast; the rest are held back rather than greyed out, so the row still
 * reads as one line of artwork.
 *
 * Picking is a single click that both shows the season and saves it, so there is no
 * "apply" step and no second highlight to explain. The only time two markers appear
 * is when the saved season is not the one on screen — arriving from a search result
 * for season 1 while season 2 is the one being watched — and then the saved one is
 * flagged in the caption instead.
 */
export function SeasonSwitcher({
  seasons,
  seriesTitle,
  viewingProviderId,
  currentProviderId,
  lang,
  onSelect,
}: {
  seasons: Season[];
  seriesTitle: string;
  /** The season whose details the page is showing. */
  viewingProviderId: string;
  /** The season saved as the user's current one. */
  currentProviderId: string;
  lang: TitleLanguage;
  onSelect: (season: Season) => void;
}) {
  return (
    // Negative margins let the row bleed to the screen edge on a phone while its
    // first cover still lines up with the page column.
    <div className="rail -mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1.5 sm:mx-0 sm:px-0">
      {seasons.map((season) => (
        <div key={season.media.provider_id} className="w-[100px] shrink-0 sm:w-[116px]">
          <SeasonCard
            season={season}
            seriesTitle={seriesTitle}
            isViewing={season.media.provider_id === viewingProviderId}
            isCurrent={season.media.provider_id === currentProviderId}
            lang={lang}
            onSelect={() => onSelect(season)}
          />
        </div>
      ))}
    </div>
  );
}

function SeasonCard({
  season,
  seriesTitle,
  isViewing,
  isCurrent,
  lang,
  onSelect,
}: {
  season: Season;
  seriesTitle: string;
  isViewing: boolean;
  isCurrent: boolean;
  lang: TitleLanguage;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const statusLabel = useStatusLabel();
  const { media, entry, season_number: number } = season;

  const total = media.total_units;
  const pct = entry && total ? Math.min(100, (entry.progress / total) * 100) : 0;
  const subtitle = seasonSubtitle(displayTitle(media, lang), seriesTitle);
  const name = subtitle ?? t("season.short", { n: number });

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isViewing || undefined}
      // No aria-label: the button's own content — the season badge, its name, the
      // progress and the status — is a better name than "Show season 3" is.
      className="group block w-full text-left"
    >
      <div
        className={cx(
          "relative aspect-2/3 w-full overflow-hidden rounded-poster",
          "transition ease-out will-change-transform",
          // Held back with a light hand: the gold ring is what marks the selected
          // season, so the others only need to stop competing. A heavier veil looked
          // right on the dark ground and bleached the artwork to milk on the light
          // one, where dimming means fading into the paper rather than receding.
          isViewing
            ? "motion-safe:-translate-y-0.5"
            : "opacity-[0.88] saturate-[0.9] group-hover:opacity-100 group-hover:saturate-100 motion-safe:group-hover:-translate-y-0.5",
        )}
        style={{
          boxShadow: isViewing ? "var(--shadow-poster)" : undefined,
          transitionDuration: "var(--motion-lift)",
        }}
      >
        <CoverImage media={media} lang={lang} className="h-full w-full" />

        {/* The selected ring is an inset shadow rather than a border so it follows
            the poster's radius exactly and takes no space from the artwork. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-poster transition-shadow"
          style={{
            boxShadow: isViewing
              ? "inset 0 0 0 2px var(--stamp)"
              : "var(--rim), inset 0 0 0 0 var(--stamp)",
            transitionDuration: "var(--motion-lift)",
          }}
        />

        <span className="font-mono absolute left-1.5 top-1.5 rounded-pill bg-ink-950/80 px-1.5 py-px text-[10px] font-medium text-paper backdrop-blur">
          {t("season.number", { n: number })}
        </span>

        {isViewing && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-stamp text-ink-950"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}

        {pct > 0 && (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-ink-950/40">
            <div
              className="h-full bg-stamp transition-[width]"
              style={{ width: `${pct}%`, transitionDuration: "var(--motion-lift)" }}
            />
          </div>
        )}
      </div>

      <p
        className={cx(
          "font-display mt-2 line-clamp-1 text-[12px] font-semibold leading-tight",
          isViewing ? "text-text" : "text-text-dim group-hover:text-text",
        )}
      >
        {name}
      </p>
      <p className="tabular mt-[3px] line-clamp-1 text-[10.5px] text-text-faint">
        {entry ? (
          <>
            {entry.progress}
            {total ? `/${total}` : ""}
            {/* The status is the first thing to go when the card is narrow: the
                fraction is the number being compared across seasons, and keeping
                both truncated the line to "25/25 ·…" on a phone. */}
            <span className="hidden sm:inline"> · {statusLabel(entry.status, media.type)}</span>
          </>
        ) : total ? (
          t(media.type === "manga" ? "season.chapters" : "season.episodes", { n: total })
        ) : (
          t("season.untracked")
        )}
      </p>
      {/* Only worth saying when the saved season is not the one on screen. */}
      {isCurrent && !isViewing && (
        <p className="mt-[3px] text-[10.5px] font-medium text-stamp-text">{t("season.current")}</p>
      )}
    </button>
  );
}
