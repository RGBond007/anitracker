import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { Season, TitleLanguage } from "../../lib/api-client";
import { cx } from "../../lib/cx";
import { CoverImage } from "./CoverImage";
import { useSeasonLabels } from "./seasonLabels";

/**
 * Bring the viewed member into the middle of its scroller.
 *
 * A show with twelve members scrolls, and season 6 starts off the right-hand edge —
 * so opening season 6 would show a row that appears to begin at season 1 with
 * nothing selected in it. Set directly rather than through `scrollIntoView`, which
 * also scrolls the page vertically to reach the element.
 */
function useCentreOnViewed(viewingProviderId: string) {
  const scroller = useRef<HTMLDivElement>(null);
  const item = useRef<HTMLElement | null>(null);

  // A callback ref, so the same hook serves the carousel's <div> cells and the chip
  // row's <button>s without either having to know the other's element type.
  const active = useCallback((el: HTMLElement | null) => {
    item.current = el;
  }, []);

  useEffect(() => {
    const box = scroller.current;
    const el = item.current;
    if (!box || !el) return;
    box.scrollLeft = Math.max(0, el.offsetLeft - (box.clientWidth - el.clientWidth) / 2);
  }, [viewingProviderId]);

  return { scroller, active };
}

/**
 * The season carousel on a title's page: browsing, not choosing.
 *
 * Clicking a card shows that season and nothing more — the user's current season is
 * moved by the action beside the title, never by looking around. That makes two
 * states that have to be told apart at a glance, so they are told apart twice over
 * and never by colour alone:
 *
 * - **viewed** — a paper outline and a lifted card, the one whose details fill the
 *   page. A shape, so it survives a colourblind reader and a greyscale print.
 * - **current** — a filled dot and the words "Watching now" under the artwork. Text,
 *   so it survives the same.
 *
 * Both at once is the ordinary case and reads as both: outlined *and* labelled.
 */
export function SeasonSwitcher({
  seasons,
  seriesTitle,
  viewingProviderId,
  lang,
  onView,
}: {
  seasons: Season[];
  seriesTitle: string;
  /** The member whose details the page is showing. Comes from the URL. */
  viewingProviderId: string;
  lang: TitleLanguage;
  onView: (season: Season) => void;
}) {
  const { scroller, active } = useCentreOnViewed(viewingProviderId);

  return (
    // Negative margins let the row bleed to the screen edge on a phone while its
    // first cover still lines up with the page column.
    <div
      ref={scroller}
      className="rail -mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1.5 sm:mx-0 sm:px-0"
      role="list"
    >
      {seasons.map((season) => (
        <div
          key={season.media.provider_id}
          ref={season.media.provider_id === viewingProviderId ? active : undefined}
          className="w-[112px] shrink-0 sm:w-[128px]"
          role="listitem"
        >
          <SeasonCard
            season={season}
            seriesTitle={seriesTitle}
            isViewing={season.media.provider_id === viewingProviderId}
            lang={lang}
            onView={() => onView(season)}
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
  lang,
  onView,
}: {
  season: Season;
  seriesTitle: string;
  isViewing: boolean;
  lang: TitleLanguage;
  onView: () => void;
}) {
  const { t } = useTranslation();
  const { badge, name, statusLine } = useSeasonLabels();
  const { media, entry, is_current: isCurrent } = season;

  const total = media.total_units;
  const pct = entry && total ? Math.min(100, (entry.progress / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onView}
      aria-current={isViewing || undefined}
      className="group block w-full text-left"
    >
      <div
        className={cx(
          "relative aspect-2/3 w-full overflow-hidden rounded-poster",
          "transition ease-out will-change-transform",
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

        {/* The viewed outline is an inset shadow rather than a border so it follows
            the poster's radius exactly and takes no space from the artwork. It is
            paper, not gold: gold means "current" everywhere else in this component. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-poster transition-shadow"
          style={{
            boxShadow: isViewing
              ? "inset 0 0 0 2px var(--text), var(--rim)"
              : "var(--rim), inset 0 0 0 0 var(--text)",
            transitionDuration: "var(--motion-lift)",
          }}
        />

        <span className="font-mono absolute left-1.5 top-1.5 rounded-pill bg-ink-950/80 px-1.5 py-px text-[10px] font-medium text-paper backdrop-blur">
          {badge(season)}
        </span>

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
          "font-display mt-2 line-clamp-1 text-[12px] leading-tight",
          isViewing ? "font-bold text-text" : "font-semibold text-text-dim group-hover:text-text",
        )}
      >
        {name(season, seriesTitle, lang)}
      </p>
      <p className="tabular mt-[3px] line-clamp-1 text-[10.5px] text-text-faint">
        {statusLine(season)}
      </p>
      {isCurrent && (
        <p className="mt-[3px] flex items-center gap-1 text-[10.5px] font-medium text-stamp-text">
          <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full bg-stamp" />
          {t("season.currentShort")}
        </p>
      )}
    </button>
  );
}

/**
 * The same set, as chips — what a phone gets beside the title so the seasons are
 * reachable without scrolling past the synopsis to the carousel below.
 */
export function SeasonChips({
  seasons,
  viewingProviderId,
  onView,
}: {
  seasons: Season[];
  viewingProviderId: string;
  onView: (season: Season) => void;
}) {
  const { t } = useTranslation();
  const { badge } = useSeasonLabels();
  const { scroller, active } = useCentreOnViewed(viewingProviderId);

  return (
    <div ref={scroller} className="rail -mx-5 flex gap-1.5 overflow-x-auto px-5 py-0.5" role="list">
      {seasons.map((season) => {
        const isViewing = season.media.provider_id === viewingProviderId;
        return (
          <button
            key={season.media.provider_id}
            ref={isViewing ? active : undefined}
            type="button"
            role="listitem"
            onClick={() => onView(season)}
            aria-current={isViewing || undefined}
            className={cx(
              "font-mono flex shrink-0 items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] transition",
              isViewing
                ? "border-text bg-text font-semibold text-bg"
                : "border-line bg-surface text-text-dim",
            )}
          >
            {season.is_current && (
              <>
                <span
                  aria-hidden
                  className={cx(
                    "h-[5px] w-[5px] shrink-0 rounded-full",
                    // On the filled chip the gold dot would sit on paper and lose
                    // its contrast, so it inverts to the chip's own ground.
                    isViewing ? "bg-bg" : "bg-stamp",
                  )}
                />
                <span className="sr-only">{t("season.currentBadge")}</span>
              </>
            )}
            {badge(season)}
          </button>
        );
      })}
    </div>
  );
}
