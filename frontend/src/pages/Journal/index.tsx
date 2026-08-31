import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useJournalTimeline } from "../../features/journal/useJournal";
import { useUiStore } from "../../stores/uiStore";
import { CoverImage } from "../../components/media/CoverImage";
import { mediaHref } from "../../components/media/Poster";
import { displayTitle } from "../../lib/titles";
import { calendarDate } from "../../lib/time";
import { Chip } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHead } from "../../components/layout/Rail";
import { Skeleton } from "../../components/ui/Skeleton";
import { Spoiler } from "../../components/ui/Spoiler";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

/**
 * Everything you have written, newest first.
 *
 * The page the feature exists for: the notes are worth keeping because they are
 * worth rereading, and a note you can only find by opening the title it belongs
 * to is not really findable. Grouped by day so it reads as a diary rather than
 * as a table.
 *
 * Yours alone. There is no route, endpoint or parameter here that shows anyone
 * else's — this is not a review site and has no reader but its author.
 */
export function JournalPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("nav.journal"));
  const lang = useUiStore((s) => s.titleLanguage);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { data, isLoading } = useJournalTimeline(favoritesOnly);

  const rows = data ?? [];

  // One heading per day, in the order the rows already arrive.
  const days: { day: string; rows: typeof rows }[] = [];
  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else days.push({ day, rows: [row] });
  }

  return (
    <div className="wrap py-8">
      <PageHead title={t("journal.pageTitle")}>{t("journal.pageHint")}</PageHead>
      <p className="-mt-3 mb-5 text-[13px] text-text-dim">{t("journal.pageHint")}</p>

      <div className="mb-6 flex gap-2">
        <Chip active={!favoritesOnly} onClick={() => setFavoritesOnly(false)}>
          {t("journal.all")}
        </Chip>
        <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(true)}>
          {t("journal.favorites")}
        </Chip>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState>{t(favoritesOnly ? "journal.noFavorites" : "journal.pageEmpty")}</EmptyState>
      ) : (
        <div className="space-y-7">
          {days.map(({ day, rows: dayRows }) => (
            <section key={day}>
              <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                {calendarDate(day, i18n.language)}
              </h2>
              <ol className="divide-y divide-line border-t border-line">
                {dayRows.map((row) => {
                  const isManga = row.media?.type === "manga";
                  return (
                    <li key={row.id} className="flex items-start gap-3 py-3">
                      {row.media && (
                        <Link
                          to={mediaHref(row.media)}
                          className="w-[34px] shrink-0 overflow-hidden rounded-[4px]"
                          style={{ boxShadow: "var(--rim)" }}
                        >
                          <CoverImage media={row.media} lang={lang} className="aspect-2/3 w-full" />
                        </Link>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px]">
                          {row.media && (
                            <Link
                              to={mediaHref(row.media)}
                              className="font-display font-semibold hover:text-stamp-text"
                            >
                              {displayTitle(row.media, lang)}
                            </Link>
                          )}
                          <span className="ml-1.5 text-text-dim">
                            {t(isManga ? "journal.chapterRead" : "journal.episodeWatched", {
                              n: row.unit,
                            })}
                          </span>
                          {row.rewatch_index > 0 && (
                            <span className="ml-1.5 text-[11.5px] text-text-faint">
                              {t("journal.pass", { n: row.rewatch_index + 1 })}
                            </span>
                          )}
                          {row.is_favorite && <span className="ml-1.5 text-stamp-text">★</span>}
                          {row.mood && (
                            <span className="ml-1.5 text-[11.5px] text-text-dim">
                              {t(`journal.mood.${row.mood}`)}
                            </span>
                          )}
                        </p>

                        {row.note &&
                          (row.has_spoilers ? (
                            <Spoiler className="mt-1" reason={t("journal.markedSpoiler")}>
                              <span className="block whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-dim">
                                “{row.note}”
                              </span>
                            </Spoiler>
                          ) : (
                            <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-dim">
                              “{row.note}”
                            </p>
                          ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
