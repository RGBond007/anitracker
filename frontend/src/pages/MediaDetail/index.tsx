import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";

import type { MediaType } from "../../lib/api-client";
import { useAddEntry, useEntryForMedia, useMediaDetail } from "../../features/media/useMedia";
import { useUiStore } from "../../stores/uiStore";
import { displayTitle } from "../../lib/titles";
import { CoverImage } from "../../components/media/CoverImage";
import { EntryForm } from "../../components/media/EntryForm";
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
  const { provider = "", id = "" } = useParams();
  const [params] = useSearchParams();
  const type = (params.get("type") as MediaType) ?? "anime";
  const lang = useUiStore((s) => s.titleLanguage);

  const media = useMediaDetail(provider, id, type);
  const entry = useEntryForMedia(provider, id);
  const add = useAddEntry();

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
  const title = displayTitle(m, lang);
  const alternates = [m.title_romaji, m.title_english, m.title_native].filter(
    (x, i, arr) => x && x !== title && arr.indexOf(x) === i,
  );

  return (
    // Every other page sits in `wrap`; without it this one ran edge-to-edge and
    // the cover was clipped against the left of the viewport.
    <div className="wrap space-y-6 py-8">
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          <CoverImage media={m} lang={lang} className="aspect-2/3 w-full" />
          {!entry.data && (
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

      {/* The list-entry form is inline on this page, not behind a modal (§4). */}
      {entry.data && (
        <Panel>
          <PanelHeader>{t("entry.edit")}</PanelHeader>
          <div className="p-4">
            <EntryForm entry={entry.data} type={m.type} />
          </div>
        </Panel>
      )}
    </div>
  );
}
