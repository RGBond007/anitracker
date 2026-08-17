import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import type { MediaType } from "../../lib/api-client";
import { useSearch } from "../../features/media/useMedia";
import { useUiStore } from "../../stores/uiStore";
import { GenreFilter } from "../../components/media/GenreFilter";
import { SeriesResults } from "../../components/media/SeriesResults";
import { SectionHead } from "../../components/layout/Rail";
import { PosterGridSkeleton } from "../../components/ui/Skeleton";
import { EmptyState, ErrorNote } from "../../components/ui/EmptyState";
import { Button, Chip } from "../../components/ui/Button";
import { SearchField } from "../../components/ui/SearchField";

export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const lang = useUiStore((s) => s.titleLanguage);

  const query = params.get("q") ?? "";
  const type = (params.get("type") as MediaType) ?? "anime";
  const genres = params.getAll("genre");
  const [draft, setDraft] = useState(query);

  useEffect(() => setDraft(query), [query]);

  /**
   * Write the query into the URL — where the whole page's state lives, so a search
   * survives a reload and can be sent to someone.
   *
   * The categories go with it. They are facets of one set of results, and carrying
   * "Action" over into a search for something with no action in it would answer a
   * new question with an old filter and show nothing, for no visible reason.
   */
  const applyQuery = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        next.delete("genre");
        return next;
      },
      { replace: true },
    );

  // Debounced so a fast typist does not burn the provider rate limit. Submitting
  // the form applies immediately and this then sees nothing left to do.
  useEffect(() => {
    if (draft === query) return;
    const id = setTimeout(() => applyQuery(draft), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setType = (option: MediaType) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("type", option);
        // Anime genres are not manga genres, and the counts would be lies.
        next.delete("genre");
        return next;
      },
      { replace: true },
    );

  const setGenres = (chosen: string[]) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("genre");
        for (const genre of chosen) next.append("genre", genre);
        return next;
      },
      { replace: true },
    );

  const { data, isFetching, error, refetch } = useSearch(query, type);

  const results = data?.results ?? [];
  const shown = genres.length
    ? results.filter((media) => genres.every((genre) => media.genres.includes(genre)))
    : results;

  return (
    <div className="wrap py-8">
      <SectionHead>{t("search.title")}</SectionHead>

      <SearchField
        autoFocus
        value={draft}
        onChange={setDraft}
        onSubmit={() => applyQuery(draft)}
        busy={isFetching && query.trim().length > 0}
        label={t("search.label")}
        clearLabel={t("search.clear")}
        placeholder={t("search.placeholder")}
      />

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("search.typeLabel")}>
        {(["anime", "manga"] as MediaType[]).map((option) => (
          <Chip key={option} active={type === option} onClick={() => setType(option)}>
            {t(`common.${option}`)}
          </Chip>
        ))}
      </div>

      {/* The categories are part of the result set, so they appear with it and
          never as an empty control on a page that has nothing to filter. */}
      {results.length > 0 && (
        <div className="mt-3 border-t border-line pt-4">
          <GenreFilter results={results} selected={genres} onChange={setGenres} />
          <p role="status" className="mt-3 text-[12px] text-text-faint">
            {genres.length > 0
              ? t("search.resultCountFiltered", { count: shown.length, total: results.length })
              : t("search.resultCount", { count: results.length })}
          </p>
        </div>
      )}

      <div className="mt-7">
        {!query.trim() ? (
          <EmptyState>{t("search.prompt")}</EmptyState>
        ) : isFetching ? (
          <PosterGridSkeleton />
        ) : error ? (
          <ErrorNote action={<Button onClick={() => void refetch()}>{t("common.retry")}</Button>}>
            {t("search.providersDown")}
          </ErrorNote>
        ) : results.length === 0 ? (
          <EmptyState>{t("search.noResults", { query })}</EmptyState>
        ) : shown.length === 0 ? (
          // The search worked and the filter is what emptied the page, so the way
          // out is the filter rather than the query.
          <EmptyState
            action={<Button onClick={() => setGenres([])}>{t("search.clearCategories")}</Button>}
          >
            {t("search.noneInCategories")}
          </EmptyState>
        ) : (
          // One card per show, not one per season: six rows of Attack on Titan used
          // to bury every other match.
          <SeriesResults results={shown} lang={lang} />
        )}
      </div>
    </div>
  );
}
