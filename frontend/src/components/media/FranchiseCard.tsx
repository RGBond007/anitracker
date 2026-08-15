import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import type { TitleLanguage } from "../../lib/api-client";
import { type Franchise, baseTitle, nextSeasonId } from "../../lib/franchise";
import { useAddEntry } from "../../features/media/useMedia";
import { displayTitle } from "../../lib/titles";
import { cx } from "../../lib/cx";
import { CoverImage } from "./CoverImage";
import { mediaHref } from "./Poster";

/**
 * One card per show rather than per season.
 *
 * The artwork, progress bar and caption all follow the *active* season, so a card
 * for Tokyo Ghoul shows season 3's cover while you are on season 3. When a season
 * is finished and the next one exists, the card offers it — it never adds anything
 * to the list on its own.
 */
export function FranchiseCard({
  franchise,
  lang,
}: {
  franchise: Franchise;
  lang: TitleLanguage;
}) {
  const { t } = useTranslation();
  const add = useAddEntry();
  const { active, seasons, isMultiSeason } = franchise;
  const media = active.media;

  const total = media.total_units;
  const pct = total ? Math.min(100, (active.progress / total) * 100) : 0;
  // Label off the *chain* position, not how many seasons happen to be on the list:
  // owning only season 3 of Mushoku Tensei still means you are on season 3.
  const season = media.season_number ?? 1;
  const isLaterSeason = season > 1;
  const label = isLaterSeason ? baseTitle(displayTitle(media, lang)) : displayTitle(media, lang);
  const nextId = nextSeasonId(franchise);

  return (
    <div className="group/card">
      <Link to={mediaHref(media)} className="group block w-full" aria-label={label}>
        <div
          className={cx(
            "relative aspect-2/3 w-full overflow-hidden rounded-poster",
            "transition-transform ease-out will-change-transform",
            "motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:scale-[1.02]",
          )}
          style={{ boxShadow: "var(--shadow-poster)", transitionDuration: "var(--motion-lift)" }}
        >
          <CoverImage media={media} lang={lang} className="h-full w-full" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-poster"
            style={{ boxShadow: "var(--rim)" }}
          />

          {/* Only worth saying when there is more than one season. */}
          {isLaterSeason && (
            <span className="font-mono absolute left-2 top-2 rounded-pill bg-ink-950/80 px-2 py-0.5 text-[10px] font-medium text-paper backdrop-blur">
              {t("season.short", { n: season })}
            </span>
          )}

          {pct > 0 && (
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-ink-950/40">
              <div className="h-full bg-stamp" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>

        <div className="mt-2.5">
          <p className="font-display line-clamp-2 text-[13px] font-semibold leading-[1.3] group-hover:text-stamp-text sm:min-h-[2.6em]">
            {label}
          </p>
          <p className="tabular mt-[3px] text-[11px] text-text-faint">
            {isLaterSeason && `${t("season.short", { n: season })} · `}
            {total ? `${active.progress}/${total}` : `${active.progress}`}
            {isMultiSeason && ` · ${t("season.owned", { count: seasons.length })}`}
          </p>
        </div>
      </Link>

      {nextId && (
        <button
          type="button"
          disabled={add.isPending}
          onClick={() =>
            add.mutate({
              provider: media.provider,
              provider_id: nextId,
              type: media.type,
              status: "current",
              progress: 0,
            })
          }
          className="mt-2 w-full rounded-control border border-stamp/50 px-2 py-1.5 text-[11px] text-stamp-text transition-colors hover:bg-stamp hover:text-ink-950"
        >
          {t("season.start", { n: (media.season_number ?? 1) + 1 })}
        </button>
      )}
    </div>
  );
}
