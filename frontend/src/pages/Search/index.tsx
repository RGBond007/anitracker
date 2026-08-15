import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import type { MediaType } from "../../lib/api-client";
import { useSearch } from "../../features/media/useMedia";
import { useUiStore } from "../../stores/uiStore";
import { Poster } from "../../components/media/Poster";
import { PosterGrid, SectionHead } from "../../components/layout/Rail";
import { PosterGridSkeleton } from "../../components/ui/Skeleton";
import { EmptyState, ErrorNote } from "../../components/ui/EmptyState";
import { Button, Chip } from "../../components/ui/Button";

export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const lang = useUiStore((s) => s.titleLanguage);

  const query = params.get("q") ?? "";
  const type = (params.get("type") as MediaType) ?? "anime";
  const [draft, setDraft] = useState(query);

  useEffect(() => setDraft(query), [query]);

  // Debounced so a fast typist does not burn the provider rate limit.
  useEffect(() => {
    if (draft === query) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      draft ? next.set("q", draft) : next.delete("q");
      setParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const { data, isFetching, error, refetch } = useSearch(query, type);

  return (
    <div className="wrap py-8">
      <SectionHead>{t("search.title")}</SectionHead>

      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t("search.placeholder")}
        aria-label={t("search.label")}
        className="w-full rounded-control border border-control-line bg-surface px-4 py-3 text-sm text-text outline-none placeholder:text-text-faint focus:border-stamp"
      />

      <div className="mb-7 mt-4 flex gap-2">
        {(["anime", "manga"] as MediaType[]).map((option) => (
          <Chip
            key={option}
            active={type === option}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("type", option);
              setParams(next, { replace: true });
            }}
          >
            {t(`common.${option}`)}
          </Chip>
        ))}
      </div>

      {!query.trim() ? (
        <EmptyState>{t("search.prompt")}</EmptyState>
      ) : isFetching ? (
        <PosterGridSkeleton />
      ) : error ? (
        <ErrorNote action={<Button onClick={() => void refetch()}>{t("common.retry")}</Button>}>
          {t("search.providersDown")}
        </ErrorNote>
      ) : !data || data.results.length === 0 ? (
        <EmptyState>{t("search.noResults", { query })}</EmptyState>
      ) : (
        <PosterGrid>
          {data.results.map((media) => (
            <Poster key={`${media.provider}-${media.provider_id}`} media={media} lang={lang} />
          ))}
        </PosterGrid>
      )}
    </div>
  );
}
