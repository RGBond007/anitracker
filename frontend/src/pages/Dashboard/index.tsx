import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { Entry } from "../../lib/api-client";
import { useDashboard } from "../../features/dashboard/useDashboard";
import { useFeed } from "../../features/social/useSocial";
import { useEntries, useIncrementEntry } from "../../features/media/useMedia";
import { useUiStore } from "../../stores/uiStore";
import { PageHead, Rail, RailItem, SectionHead } from "../../components/layout/Rail";
import { AddPoster, Poster } from "../../components/media/Poster";
import { Hero } from "../../components/media/Hero";
import { Reactions } from "../../components/media/Reactions";
import { NextUp } from "../../components/media/NextUp";
import { Tonight } from "../../components/media/Tonight";
import { Schedule, useSchedule } from "../../components/media/Schedule";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote } from "../../components/ui/EmptyState";
import { PosterGridSkeleton, Skeleton } from "../../components/ui/Skeleton";
import { relativeTime } from "../../lib/time";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useDashboardPrefs, type SectionId } from "../../features/dashboard/useDashboardPrefs";

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


export function DashboardPage() {
  const { t } = useTranslation();

  useDocumentTitle(t("nav.dashboard"));
  const lang = useUiStore((s) => s.titleLanguage);
  const { data, isLoading, error, refetch } = useDashboard();
  const increment = useIncrementEntry();
  const feed = useFeed();
  const schedule = useSchedule();
  const { order, density, isHidden, hide, reset, customised } = useDashboardPrefs();

  /**
   * The whole list, for the recap — which has to count a month of finish dates and
   * cannot do it from the dashboard payload's 24 in-progress and 12 recent entries.
   * Deliberately not `library`: that one narrows with the filter chips, and a recap
   * that changes because someone tapped "Manga" is reporting the filter, not the
   * month. On the default filter this is the same query key as `library`, so the
   * common case costs no extra request.
   */
  const everything = useEntries({ sort: "updated" });

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

  /**
   * Every optional section, by id. Built here rather than inline so the order can
   * come from the reader's preference — see `useDashboardPrefs`.
   */
  const SECTIONS: Record<SectionId, ReactNode> = {
    stats: null,
    tonight: everything.data && !isHidden("tonight") ? (

              <section className="mb-8 sm:mb-14">
                <SectionHead
                  onHide={() => hide("tonight")}
                  hideLabel={t("dashboard.hideSection", { name: t("recap.heading") })}
                >
                  {t("recap.heading")}
                </SectionHead>
                {/* Recap and suggestions first, then the prompt: the month is the
                    context, and "what should I watch tonight?" is the way out when the
                    suggestions have not settled it. */}
                <NextUp entries={everything.data} lang={lang} />
                <Tonight entries={everything.data} lang={lang} />
              </section>
    ) : null,
    schedule: schedule.data && schedule.data.length > 0 && !isHidden("schedule") ? (

              <section className="mb-8 sm:mb-14">
                <SectionHead
                  onHide={() => hide("schedule")}
                  hideLabel={t("dashboard.hideSection", { name: t("schedule.heading") })}
                >
                  {t("schedule.heading")}
                </SectionHead>
                <Schedule items={schedule.data} />
              </section>
    ) : null,
    inProgress: lead && !isHidden("inProgress") ? (

              <section className="mb-8 sm:mb-14">
                <SectionHead
                  seeAll={{ to: "/list/current", label: t("common.seeAll") }}
                  onHide={() => hide("inProgress")}
                  hideLabel={t("dashboard.hideSection", { name: t("dashboard.alsoInProgress") })}
                >
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
    ) : null,
    recent: recentElsewhere.length > 0 && !isHidden("recent") ? (

              <section className="mb-8 sm:mb-14">
                <SectionHead
                  onHide={() => hide("recent")}
                  hideLabel={t("dashboard.hideSection", { name: t("dashboard.recent") })}
                >
                  {t("dashboard.recent")}
                </SectionHead>
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
    ) : null,
    friends: feed.data && feed.data.length > 0 && !isHidden("friends") ? (

              <section className="mb-8 sm:mb-14">
                {/* Same query as the friends page's own feed, deliberately. It is here
                    as a *signal* — somebody you know just finished something, which is
                    a reason to consider it tonight — and there as the feed itself. The
                    heading says which of the two this is, and "See all" says where the
                    other one lives; two sections called "Friend activity" read as the
                    same thing rendered twice. */}
                <SectionHead
                  seeAll={{ to: "/friends", label: t("common.seeAll") }}
                  onHide={() => hide("friends")}
                  hideLabel={t("dashboard.hideSection", { name: t("dashboard.friendsFinished") })}
                >
                  {t("dashboard.friendsFinished")}
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
                      {/* Only on a finish. These are *completion* reactions — offering
                          them on episode 7 of 24 would be reacting to a number. */}
                      {item.entry.status === "completed" && <Reactions entryId={item.entry.id} />}
                    </RailItem>
                  ))}
                </Rail>
              </section>
    ) : null,
  };

  return (
    <>
      {/* Before the hero, not after it: the hero answers the question, and this is
          the question. Dashboard and library are both "your titles" to anybody who
          has not used the app before — the line under each heading is where they
          say which one they are for. */}
      <div className="wrap pt-8">
        <PageHead title={t("dashboard.pageTitle")}>{t("dashboard.pageHint")}</PageHead>
      </div>

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

      {/* `data-density` drives the section spacing from one place — see the rule in
          index.css. Doing it here rather than per section means a new section
          inherits the reader's choice without having to know it exists. */}
      <div className="wrap" data-density={density}>
        {/* Numbers sit directly under the hero so the artwork sections below run
            together instead of being split in half by a band of figures. Hideable
            but not moveable: a band of figures between two poster rails is not an
            arrangement anybody wants. */}
        {!isHidden("stats") && (
          <div className="group/stats relative">
            <StatStrip items={stats} />
            <button
              type="button"
              onClick={() => hide("stats")}
              aria-label={t("dashboard.hideSection", { name: t("dashboard.statsLabel") })}
              className="absolute right-0 top-0 p-1 text-text-faint transition-colors hover:text-text pointer-coarse:min-h-[44px]"
            >
              <svg aria-hidden viewBox="0 0 24 24" width="13" height="13" fill="none"
                   stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}

        {/* Rendered from the stored order rather than written down in one, so a
            person can move a section without the page needing to know why. Each
            entry stays responsible for whether it has anything to show: a section
            with no content is `null` here and leaves no gap behind. */}
        {order.map((id: SectionId) => (
          <Fragment key={id}>{SECTIONS[id]}</Fragment>
        ))}

        {/* The way back. A preference you cannot reverse is a trap, and a control
            that only appears once something is hidden costs nothing the rest of the
            time — which is almost always. */}
        {customised && (
          <p className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-faint">
            {t("dashboard.customised")}
            <button
              type="button"
              onClick={reset}
              className="text-text-dim underline-offset-4 hover:text-text hover:underline pointer-coarse:min-h-[44px]"
            >
              {t("dashboard.resetArrangement")}
            </button>
            <Link
              to="/settings"
              className="text-text-dim underline-offset-4 hover:text-text hover:underline pointer-coarse:min-h-[44px]"
            >
              {t("dashboard.customise")}
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
