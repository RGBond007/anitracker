import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import type { MediaType, Season } from "../../lib/api-client";
import { useAddEntry, useEntryForMedia, useMediaDetail } from "../../features/media/useMedia";
import { useSelectSeason, useSeries } from "../../features/media/useSeasons";
import { useUiStore } from "../../stores/uiStore";
import { baseTitle } from "../../lib/franchise";
import { queryKeys } from "../../lib/queryKeys";
import { displayTitle } from "../../lib/titles";
import { CoverImage } from "../../components/media/CoverImage";
import { EntryForm } from "../../components/media/EntryForm";
import { mediaHref } from "../../components/media/Poster";
import { SeasonProgress } from "../../components/media/SeasonProgress";
import { SeasonSwitcher } from "../../components/media/SeasonSwitcher";
import { Button } from "../../components/ui/Button";
import { ErrorNote } from "../../components/ui/EmptyState";
import { Panel, PanelHeader } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">{label}</p>
      <p className="tabular mt-0.5 text-sm">{value}</p>
    </div>
  );
}

export function MediaDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { provider = "", id = "" } = useParams();
  const [params] = useSearchParams();
  const type = (params.get("type") as MediaType) ?? "anime";
  const lang = useUiStore((s) => s.titleLanguage);
  const toast = useUiStore((s) => s.toast);

  const media = useMediaDetail(provider, id, type);
  const entry = useEntryForMedia(provider, id);
  const series = useSeries(provider, id, type);
  const add = useAddEntry();
  const selectSeason = useSelectSeason();

  const seasons = series.data?.seasons ?? [];
  const isMultiSeason = seasons.length > 1;
  const viewing = seasons.find((s) => s.media.provider_id === id);

  /**
   * Show a season and remember it, in that order.
   *
   * The URL stays the source of truth for which season is on screen — everything
   * else on the page reads the route — so switching navigates. Nothing is refetched
   * to do it: the season's metadata and the viewer's entry both arrived with the
   * series, so they are written into the caches the new URL will read and the swap
   * paints from data already in hand instead of flashing a skeleton.
   */
  const switchTo = (season: Season) => {
    const target = season.media.provider_id;
    const root = series.data?.root_provider_id;
    if (!root) return;

    if (target !== id) {
      queryClient.setQueryData(queryKeys.media(provider, target, type), season.media);
      queryClient.setQueryData(queryKeys.entryForMedia(provider, target), season.entry);
      queryClient.setQueryData(queryKeys.series(provider, target), {
        ...series.data,
        selected_provider_id: target,
        is_explicit: true,
      });
      // `replace`, so a run of season switches leaves one entry in history and Back
      // still returns to wherever the title was opened from.
      navigate(mediaHref(season.media), { replace: true });
    }

    if (target === series.data?.selected_provider_id && series.data.is_explicit) return;
    selectSeason.mutate(
      { root, providerId: target },
      { onSuccess: () => toast(t("season.saved", { n: season.season_number })) },
    );
  };

  if (media.isLoading) {
    return (
      <div className="wrap grid gap-6 py-8 md:grid-cols-[240px_1fr]">
        <Skeleton className="aspect-2/3 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (media.error || !media.data) {
    return (
      <div className="wrap py-10">
        <ErrorNote
          action={<Button onClick={() => void media.refetch()}>{t("common.retry")}</Button>}
        >
          {t("detail.loadFailed")}
        </ErrorNote>
      </div>
    );
  }

  const m = media.data;
  const seasonTitle = displayTitle(m, lang);
  // Derived here rather than taken from the series payload, which is built from the
  // English name: the show's name has to be in the language the user reads, and the
  // switcher compares season titles against it to find their subtitles.
  const seriesTitle =
    seasons.length > 0 ? baseTitle(displayTitle(seasons[0].media, lang)) : seasonTitle;
  // On a show with seasons the heading is the show, and the season is a facet of it
  // stated above — so switching season changes the artwork and the numbers without
  // the page appearing to become a different title.
  const title = isMultiSeason ? seriesTitle : seasonTitle;
  const alternates = [seasonTitle, m.title_romaji, m.title_english, m.title_native].filter(
    (x, i, arr) => x && x !== title && arr.indexOf(x) === i,
  );

  return (
    // Every other page sits in `wrap`; without it this one ran edge-to-edge and
    // the cover was clipped against the left of the viewport.
    <div className="wrap space-y-6 py-8">
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          {/* Keyed on the season, so switching cross-fades to the new artwork
              instead of repainting the old <img> in place. */}
          <CoverImage
            key={m.provider_id}
            media={m}
            lang={lang}
            className="aspect-2/3 w-full rounded-poster"
          />

          {entry.data ? (
            <SeasonProgress entry={entry.data} />
          ) : (
            <Button
              variant="stamp"
              className="w-full"
              disabled={add.isPending}
              onClick={() =>
                add.mutate({
                  provider,
                  provider_id: id,
                  type,
                  status: "planned",
                  progress: 0,
                })
              }
            >
              {t("detail.addToList")}
            </Button>
          )}
        </div>

        <div className="space-y-5">
          <div>
            {isMultiSeason && (
              <p className="font-mono mb-1.5 text-[11px] uppercase tracking-[0.12em]">
                <span className="text-stamp-text">
                  {t("season.short", { n: viewing?.season_number ?? m.season_number ?? 1 })}
                </span>
                <span className="text-text-faint"> {t("season.ofTotal", { total: seasons.length })}</span>
              </p>
            )}
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
              {title}
            </h1>
            {alternates.length > 0 && (
              <p className="mt-1 text-sm text-text-dim">{alternates.join(" · ")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-0.5 bg-line sm:grid-cols-4">
            <Fact
              label={m.type === "anime" ? t("detail.episodes") : t("detail.chapters")}
              value={m.total_units ?? "—"}
            />
            <Fact label={t("detail.format")} value={m.format ?? "—"} />
            <Fact label={t("detail.year")} value={m.season_year ?? "—"} />
            <Fact
              label={t("detail.communityScore")}
              value={m.average_score ? `${m.average_score}%` : "—"}
            />
          </div>

          {m.genres.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {m.genres.map((g) => (
                <li key={g} className="border border-line px-2 py-0.5 text-xs text-text-dim">
                  {g}
                </li>
              ))}
            </ul>
          )}

          {m.synopsis && (
            <section>
              <h2 className="mb-1.5 font-display text-sm font-bold uppercase tracking-[0.12em] text-text-dim">
                {t("detail.synopsis")}
              </h2>
              {/* Providers pad synopses with runs of blank lines, which
                  `whitespace-pre-line` faithfully renders as a hole in the page. */}
              <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">
                {m.synopsis.replace(/\n{3,}/g, "\n\n").trim()}
              </p>
            </section>
          )}

          {m.synonyms.length > 0 && (
            <section>
              <h2 className="mb-1 font-display text-sm font-bold uppercase tracking-[0.12em] text-text-dim">
                {t("detail.alsoKnownAs")}
              </h2>
              {/* AniList carries every localisation it knows — 20+ for a popular
                  title — which is a wall of text, not information. */}
              <p className="max-w-prose text-sm text-text-dim">
                {m.synonyms.slice(0, 8).join(" · ")}
                {m.synonyms.length > 8 && (
                  <span className="text-text-faint">
                    {" "}
                    {t("detail.moreTitles", { count: m.synonyms.length - 8 })}
                  </span>
                )}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* A show with one season has nothing to switch between, so it says nothing. */}
      {isMultiSeason && series.data && (
        <section>
          <div className="mb-3.5 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[15px] font-bold tracking-[-0.01em]">
              {t("season.heading")}
            </h2>
            <p className="text-[11.5px] text-text-faint">{t("season.pickHint")}</p>
          </div>
          <SeasonSwitcher
            seasons={seasons}
            seriesTitle={seriesTitle}
            viewingProviderId={id}
            currentProviderId={series.data.selected_provider_id}
            lang={lang}
            onSelect={switchTo}
          />
        </section>
      )}

      {/* The list-entry form is inline on this page, not behind a modal (§4). */}
      {entry.data && (
        <Panel>
          <PanelHeader>{t("entry.edit")}</PanelHeader>
          <div className="p-4">
            {/* Keyed on the entry so switching season resets the form's defaults to
                that season's own progress rather than keeping the last one's. */}
            <EntryForm key={entry.data.id} entry={entry.data} type={m.type} />
          </div>
        </Panel>
      )}
    </div>
  );
}
