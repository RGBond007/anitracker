import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import type { MediaType } from "../../lib/api-client";
import { useSearch } from "../../features/media/useMedia";
import { useUiStore } from "../../stores/uiStore";
import { groupSearchResults } from "../../lib/searchGroups";
import { PosterGrid, SectionHead } from "../../components/layout/Rail";
import { Poster } from "../../components/media/Poster";
import { Button, Chip } from "../../components/ui/Button";
import { EmptyState, ErrorNote } from "../../components/ui/EmptyState";
import { PosterGridSkeleton } from "../../components/ui/Skeleton";
import { SearchField } from "../../components/ui/SearchField";
import { SearchIdleState } from "./EmptyState";
import { FilterMenu } from "./FilterMenu";
import {
  NO_FILTERS,
  applyFilters,
  facetsOf,
  forgetSearches,
  readFilters,
  readRecent,
  rememberSearch,
  writeFilters,
  type SearchFilters,
} from "./filters";
import { FranchiseResult, OtherMatches, useLibraryOverlay } from "./results";

export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const lang = useUiStore((s) => s.titleLanguage);

  const query = params.get("q") ?? "";
  const type = (params.get("type") as MediaType) ?? "anime";
  const filters = readFilters(params);
  const [draft, setDraft] = useState(query);
  const [recent, setRecent] = useState(readRecent);

  useEffect(() => setDraft(query), [query]);

  /**
   * The query lives in the URL, which is where the whole page's state lives, so
   * a search survives a reload and can be sent to someone. Filters are cleared
   * with it: they are facets of one result set, and carrying "2013" into an
   * unrelated search would empty the page for no visible reason.
   */
  const applyQuery = (value: string) => {
    setParams(
      (prev) => {
        // Format, status and year are facets of one result set and go with it.
        // Genres do not: they narrow the search itself, so "Thriller" survives
        // typing a new title the way the Anime/Manga choice does.
        const kept = { ...NO_FILTERS, genres: readFilters(prev).genres };
        const next = writeFilters(new URLSearchParams(prev), kept);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
    if (value.trim()) setRecent(rememberSearch(value));
  };

  // Debounced so a fast typist does not burn the provider's rate limit.
  // Submitting the form applies at once, and this then has nothing left to do.
  useEffect(() => {
    if (draft === query) return;
    const id = setTimeout(() => applyQuery(draft), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setType = (option: MediaType) =>
    setParams(
      (prev) => {
        const kept = { ...NO_FILTERS, genres: readFilters(prev).genres };
        const next = writeFilters(new URLSearchParams(prev), kept);
        next.set("type", option);
        return next;
      },
      { replace: true },
    );

  const setFilters = (next: SearchFilters) =>
    setParams((prev) => writeFilters(new URLSearchParams(prev), next), { replace: true });

  const { data, isFetching, error, refetch } = useSearch(query, type, filters.genres);
  const overlay = useLibraryOverlay();

  const results = useMemo(() => data?.results ?? [], [data]);
  const shown = useMemo(() => applyFilters(results, filters), [results, filters]);
  // Grouped after filtering, so a franchise is built from the seasons that
  // survived rather than assembled and then gutted.
  const groups = useMemo(() => groupSearchResults(shown, lang), [shown, lang]);
  const facets = useMemo(() => facetsOf(results), [results]);

  const franchises = groups.filter((g) => g.seasons.length > 1);
  const singles = groups.filter((g) => g.seasons.length <= 1);
  // Everything that is not part of a run: a group's own extras, plus any lone
  // movie or OVA the search turned up on its own.
  const others = [
    ...franchises.flatMap((g) => g.extras),
    ...singles.flatMap((g) => g.members),
  ];

  // A genre with no term is still a search — of the genre.
  const searching = query.trim().length > 0 || filters.genres.length > 0;

  return (
    <div className="wrap py-8">
      <SectionHead>{t("search.title")}</SectionHead>

      {/* One row: the field, what it found, and the way to narrow it. The count
          drops below the field before the button ever wraps away from it. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-[240px] flex-1 items-center gap-3">
          <div className="min-w-0 flex-1">
            <SearchField
              autoFocus
              value={draft}
              onChange={setDraft}
              onSubmit={() => applyQuery(draft)}
              busy={isFetching && searching}
              label={t("search.label")}
              clearLabel={t("search.clear")}
              placeholder={t("search.placeholder")}
            />
          </div>
          <FilterMenu filters={filters} facets={facets} onApply={setFilters} />
        </div>

        {searching && !isFetching && !error && (
          <p role="status" className="tabular text-[12px] text-text-faint">
            {t("search.resultCount", { count: shown.length })}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("search.typeLabel")}>
        {(["anime", "manga"] as MediaType[]).map((option) => (
          <Chip key={option} active={type === option} onClick={() => setType(option)}>
            {t(`common.${option}`)}
          </Chip>
        ))}
      </div>

      <div className="mt-8">
        {!searching ? (
          <SearchIdleState
            type={type}
            lang={lang}
            recent={recent}
            onPick={(q) => {
              setDraft(q);
              applyQuery(q);
            }}
            onClearRecent={() => {
              forgetSearches();
              setRecent([]);
            }}
          />
        ) : isFetching ? (
          <PosterGridSkeleton />
        ) : error ? (
          <ErrorNote action={<Button onClick={() => void refetch()}>{t("common.retry")}</Button>}>
            {t("search.providersDown")}
          </ErrorNote>
        ) : results.length === 0 ? (
          <EmptyState
            action={
              filters.genres.length > 0 ? (
                <Button onClick={() => setFilters({ ...filters, genres: [] })}>
                  {t("search.clearGenres")}
                </Button>
              ) : undefined
            }
          >
            {query.trim()
              ? t("search.noResults", { query })
              : t("search.noResultsGenre", { genres: filters.genres.join(", ") })}
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState
            action={<Button onClick={() => setFilters(NO_FILTERS)}>{t("search.reset")}</Button>}
          >
            {t("search.noneMatchFilters")}
          </EmptyState>
        ) : (
          <>
            {franchises.map((group) => (
              <FranchiseResult key={group.key} group={group} lang={lang} overlay={overlay} />
            ))}

            {/* Lone titles keep the library's poster grid; only a run of seasons
                earns the wider franchise layout. */}
            {franchises.length === 0 && singles.length > 0 ? (
              <PosterGrid>
                {singles.map((group) => (
                  <Poster
                    key={group.key}
                    media={group.main}
                    lang={lang}
                    meta={[group.main.format, group.main.season_year].filter(Boolean).join(" · ")}
                  />
                ))}
              </PosterGrid>
            ) : (
              <OtherMatches items={others} lang={lang} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
