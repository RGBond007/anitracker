import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { Entry, Media, MediaType, TitleLanguage } from "../../lib/api-client";
import { useEntries } from "../../features/media/useMedia";
import { useSeasonSelections } from "../../features/media/useSeasons";
import { cx } from "../../lib/cx";
import { seasonLabel, type SearchFranchise } from "../../lib/searchGroups";
import { PosterGrid } from "../../components/layout/Rail";
import { CoverImage } from "../../components/media/CoverImage";
import { Poster, mediaHref } from "../../components/media/Poster";
import { useStatusLabel } from "../../components/media/statusLabels";

/**
 * What the viewer already has, laid over the results.
 *
 * Both queries are ones the app makes elsewhere, so showing progress on the
 * search page costs no extra round trip on a warm cache. `chosen` holds only
 * seasons the viewer explicitly picked -- nothing is marked "current" on a show
 * they have never made a choice about.
 */
export function useLibraryOverlay() {
  const entries = useEntries({});
  const selections = useSeasonSelections();

  const byProviderId = new Map<string, Entry>();
  for (const entry of entries.data ?? []) byProviderId.set(entry.media.provider_id, entry);

  return {
    entries: byProviderId,
    chosen: new Set(Object.values(selections.data ?? {})),
  };
}

export interface Overlay {
  entries: Map<string, Entry>;
  chosen: Set<string>;
}

/** The years a franchise spans: "2013 – 2023", or the single year it ran. */
function releaseRange(members: Media[]): string | null {
  const years = members.map((m) => m.season_year).filter((y): y is number => Boolean(y));
  if (years.length === 0) return null;
  const first = Math.min(...years);
  const last = Math.max(...years);
  return first === last ? String(first) : `${first} – ${last}`;
}

/**
 * One show, with its seasons beside it.
 *
 * The left column is the show -- artwork, name, what it is, how long it ran --
 * and the right is the run of seasons, which is what someone searching a
 * franchise came for. Flat: a rule underneath separates it from the next
 * result, and nothing is boxed inside anything else.
 */
export function FranchiseResult({
  group,
  lang,
  overlay,
}: {
  group: SearchFranchise;
  lang: TitleLanguage;
  overlay: Overlay;
}) {
  const { t } = useTranslation();
  const { main, seasons, title } = group;
  const range = releaseRange(group.members);

  return (
    <article className="border-b border-line py-7 first:pt-0">
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-7">
        <div className="flex gap-4 sm:w-[236px] sm:shrink-0 sm:flex-col sm:gap-3">
          <Link to={mediaHref(main)} aria-label={title} className="w-[92px] shrink-0 sm:w-[136px]">
            <CoverImage media={main} lang={lang} className="aspect-2/3 w-full rounded-poster" />
          </Link>

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[17px] font-bold leading-tight tracking-[-0.01em]">
              <Link to={mediaHref(main)} className="hover:text-stamp-text">
                {title}
              </Link>
            </h3>
            <p className="tabular mt-1 text-[12px] text-text-dim">
              {[main.format, range].filter(Boolean).join(" · ")}
            </p>
            <p className="tabular mt-0.5 text-[12px] text-text-faint">
              {[
                main.average_score ? `${main.average_score}%` : null,
                group.members.length > 1
                  ? t("search.relatedEntries", { count: group.members.length })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {seasons.length > 1 && (
          <div className="min-w-0 flex-1">
            <h4 className="font-mono mb-2.5 text-[10px] uppercase tracking-[0.1em] text-text-dim">
              {t("search.seasons")}
            </h4>
            {/* Scrolls rather than shrinking: eight seasons squeezed onto one
                row would make every poster a thumbnail. */}
            <div className="rail -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {seasons.map((season, index) => (
                <SeasonCell
                  key={season.provider_id}
                  media={season}
                  lang={lang}
                  label={seasonLabel(season, index, title, lang, t)}
                  entry={overlay.entries.get(season.provider_id)}
                  isCurrent={overlay.chosen.has(season.provider_id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function SeasonCell({
  media,
  lang,
  label,
  entry,
  isCurrent,
}: {
  media: Media;
  lang: TitleLanguage;
  label: string;
  entry?: Entry;
  isCurrent: boolean;
}) {
  const { t } = useTranslation();
  const statusLabel = useStatusLabel();
  const total = media.total_units;

  return (
    <Link to={mediaHref(media)} className="group w-[104px] shrink-0 sm:w-[116px]" aria-label={label}>
      <div
        className={cx(
          "relative aspect-2/3 w-full overflow-hidden rounded-poster",
          // A hairline, not a halo: the current season is marked, not lit up.
          isCurrent && "ring-1 ring-stamp",
        )}
      >
        <CoverImage media={media} lang={lang} className="h-full w-full" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-poster"
          style={{ boxShadow: "var(--rim)" }}
        />
      </div>

      <p className="font-display mt-2 truncate text-[12.5px] font-semibold group-hover:text-stamp-text">
        {label}
      </p>
      <p className="tabular mt-[2px] text-[11px] text-text-faint">
        {[media.season_year, entry ? (total ? `${entry.progress}/${total}` : entry.progress) : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {entry && (
        <p className="mt-[2px] truncate text-[11px] text-text-dim">
          {statusLabel(entry.status, media.type as MediaType)}
        </p>
      )}
      {isCurrent && (
        <p className="font-mono mt-[2px] text-[10px] uppercase tracking-[0.1em] text-stamp-text">
          {t("season.currentShort")}
        </p>
      )}
    </Link>
  );
}

/** Movies, OVAs, specials and spin-offs: related, but not part of the run. */
export function OtherMatches({ items, lang }: { items: Media[]; lang: TitleLanguage }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <section className="pt-7">
      <h3 className="font-display mb-4 text-[15px] font-bold tracking-[-0.01em]">
        {t("search.otherMatches")}
      </h3>
      <PosterGrid>
        {items.map((media) => (
          <Poster
            key={`${media.provider}-${media.provider_id}`}
            media={media}
            lang={lang}
            meta={[media.format, media.season_year].filter(Boolean).join(" · ")}
          />
        ))}
      </PosterGrid>
    </section>
  );
}
