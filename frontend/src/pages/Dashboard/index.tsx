import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { Entry, MediaType } from "../../lib/api-client";
import { useDashboard } from "../../features/dashboard/useDashboard";
import { useFeed } from "../../features/social/useSocial";
import { useEntries, useIncrementEntry } from "../../features/media/useMedia";
import { useUiStore } from "../../stores/uiStore";
import { PosterGrid, Rail, RailItem, SectionHead } from "../../components/layout/Rail";
import { AddPoster, Poster } from "../../components/media/Poster";
import { Hero } from "../../components/media/Hero";
import { Schedule, useSchedule } from "../../components/media/Schedule";
import { Button, Chip } from "../../components/ui/Button";
import { EmptyState, ErrorNote } from "../../components/ui/EmptyState";
import { PosterGridSkeleton, Skeleton } from "../../components/ui/Skeleton";
import { relativeTime } from "../../lib/time";

/** Inline figures divided by hairlines — a KPI box per number was too much chrome. */
function StatStrip({
  items,
}: {
  items: { value: string; unit?: string; label: string }[];
}) {
  return (
    <div className="mb-8 flex flex-wrap border-y border-line py-4 sm:mb-14 sm:py-[22px]">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`min-w-[45%] flex-1 px-4 sm:min-w-[120px] sm:px-7 ${i === 0 ? "pl-0" : ""} ${
            i < items.length - 1 ? "border-r border-line" : ""
          }`}
        >
          <p className="font-display text-[26px] font-bold tracking-[-0.01em]">
            {item.value}
            {item.unit && (
              <span className="ml-[5px] font-sans text-xs font-medium text-text-dim">
                {item.unit}
              </span>
            )}
          </p>
          <p className="mt-[3px] text-xs text-text-faint">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

type LibraryFilter = "all" | "anime" | "manga" | "completed";

export function DashboardPage() {
  const { t } = useTranslation();
  const lang = useUiStore((s) => s.titleLanguage);
  const { data, isLoading, error, refetch } = useDashboard();
  const increment = useIncrementEntry();
  const feed = useFeed();
  const schedule = useSchedule();
  const [filter, setFilter] = useState<LibraryFilter>("all");

  const library = useEntries(
    filter === "completed"
      ? { status: "completed", sort: "updated" }
      : filter === "all"
        ? { sort: "updated" }
        : { type: filter as MediaType, sort: "updated" },
  );

  const stats = useMemo(() => {
    if (!data) return [];
    const scored = data.anime.scored_count + data.manga.scored_count;
    const mean =
      scored > 0
        ? (
            ((data.anime.mean_score ?? 0) * data.anime.scored_count +
              (data.manga.mean_score ?? 0) * data.manga.scored_count) /
            scored
          ).toFixed(2)
        : "—";
    return [
      { value: String(data.anime.total + data.manga.total), label: t("dashboard.totalEntries") },
      { value: mean, label: t("dashboard.meanScore") },
      { value: String(data.anime.episodes_watched), label: t("dashboard.episodesWatched") },
      {
        value: data.anime.days_watched.toFixed(1),
        unit: t("dashboard.days"),
        label: t("dashboard.timeWatched"),
      },
    ];
  }, [data, t]);

  if (isLoading) {
    return (
      <>
        <Skeleton className="mb-14 h-[340px] w-full rounded-none sm:h-[420px]" />
        <div className="wrap">
          <PosterGridSkeleton count={6} />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <div className="wrap py-10">
        <ErrorNote action={<Button onClick={() => void refetch()}>{t("common.retry")}</Button>}>
          {t("dashboard.loadFailed")}
        </ErrorNote>
      </div>
    );
  }

  /**
   * The hero leads with a title whose total is known: its whole layout is a
   * progress bar and an "episode N of M" count, and a long-running manga with no
   * chapter total renders that as an empty bar next to "of —". Ordering is
   * otherwise the backend's (most recently updated first), and a list with no
   * totals at all still gets a hero rather than an empty state.
   */
  const leadIndex = Math.max(
    0,
    data.in_progress.findIndex((e) => e.media.total_units),
  );
  const lead = data.in_progress[leadIndex];
  const alsoInProgress = data.in_progress.filter((_, i) => i !== leadIndex);

  /**
   * `recently_updated` is the whole list by time, so every in-progress title is in
   * it too — without this the same poster appears in the hero, this rail, and the
   * rail above it. Filtering leaves the rail meaning "things that moved that you
   * are not currently watching": finished, planned, dropped.
   */
  const shownAbove = new Set(data.in_progress.map((e) => e.id));
  const recentElsewhere = data.recently_updated.filter((e) => !shownAbove.has(e.id));

  return (
    <>
      {lead ? (
        <Hero entry={lead} lang={lang} onIncrement={() => increment.mutate(lead.id)} />
      ) : (
        <div className="wrap py-10">
          <EmptyState
            action={
              <Link to="/search">
                <Button variant="primary">{t("dashboard.emptyCta")}</Button>
              </Link>
            }
          >
            {t("dashboard.empty")}
          </EmptyState>
        </div>
      )}

      <div className="wrap">
        {/* Numbers sit directly under the hero so the three artwork sections below
            run together instead of being split in half by a band of figures. */}
        <StatStrip items={stats} />

        {/* Absent, not empty, when nothing you watch is still broadcasting. */}
        {schedule.data && schedule.data.length > 0 && (
          <section className="mb-8 sm:mb-14">
            <SectionHead>{t("schedule.heading")}</SectionHead>
            <Schedule items={schedule.data} />
          </section>
        )}

        {/* Kept even when the rail is empty: the trailing AddPoster is the only
            "add a title" affordance on the page once you have a hero. */}
        {lead && (
          <section className="mb-8 sm:mb-14">
            <SectionHead seeAll={{ to: "/list/current", label: t("common.seeAll") }}>
              {t("dashboard.alsoInProgress")}
            </SectionHead>
            <Rail>
              {alsoInProgress.map((entry: Entry) => (
                <RailItem key={entry.id}>
                  <Poster media={entry.media} entry={entry} lang={lang} />
                </RailItem>
              ))}
              <RailItem>
                <AddPoster label={t("dashboard.addTitle")} />
              </RailItem>
            </Rail>
          </section>
        )}

        {recentElsewhere.length > 0 && (
          <section className="mb-8 sm:mb-14">
            <SectionHead>{t("dashboard.recent")}</SectionHead>
            <Rail>
              {recentElsewhere.map((entry) => (
                <RailItem key={entry.id}>
                  <Poster
                    media={entry.media}
                    entry={entry}
                    lang={lang}
                    meta={relativeTime(entry.updated_at, t)}
                  />
                </RailItem>
              ))}
            </Rail>
          </section>
        )}

        {feed.data && feed.data.length > 0 && (
          <section className="mb-8 sm:mb-14">
            <SectionHead seeAll={{ to: "/friends", label: t("common.seeAll") }}>
              {t("dashboard.friendActivity")}
            </SectionHead>
            <Rail>
              {feed.data.slice(0, 12).map((item) => (
                <RailItem key={`${item.user.id}-${item.entry.id}`}>
                  <Poster
                    media={item.entry.media}
                    entry={item.entry}
                    lang={lang}
                    meta={`${item.user.username} · ${relativeTime(item.entry.updated_at, t)}`}
                  />
                </RailItem>
              ))}
            </Rail>
          </section>
        )}

        <section className="mb-8 sm:mb-14">
          <SectionHead seeAll={{ to: "/list/current", label: t("common.seeAll") }}>
            {t("dashboard.library")}
          </SectionHead>

          <div className="mb-[22px] flex flex-wrap gap-2">
            {(["all", "anime", "manga", "completed"] as LibraryFilter[]).map((value) => (
              <Chip key={value} active={filter === value} onClick={() => setFilter(value)}>
                {t(`dashboard.filter_${value}`)}
              </Chip>
            ))}
          </div>

          {library.isLoading ? (
            <PosterGridSkeleton count={6} />
          ) : !library.data || library.data.length === 0 ? (
            <EmptyState>{t("list.empty")}</EmptyState>
          ) : (
            <PosterGrid>
              {library.data.slice(0, 18).map((entry) => (
                <Poster key={entry.id} media={entry.media} entry={entry} lang={lang} />
              ))}
            </PosterGrid>
          )}
        </section>
      </div>
    </>
  );
}
