import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { Entry, TitleLanguage } from "../../lib/api-client";
import type { Suggestion } from "../../features/dashboard/recap";
import { monthRecap, suggestions } from "../../features/dashboard/recap";
import { displayTitle } from "../../lib/titles";
import { relativeTime } from "../../lib/time";
import { CoverImage } from "./CoverImage";
import { mediaHref } from "./Poster";

/**
 * The month in one line, and the two or three things the library is waiting on.
 *
 * It sits directly under the figures because it answers the question those figures
 * raise — "so what should I open?" — and it is the only part of the dashboard that
 * reads the list rather than listing it. Both halves are absent rather than empty
 * when there is nothing true to say (§8), so a quiet month renders no section at
 * all instead of a row of zeroes.
 */
export function NextUp({ entries, lang }: { entries: Entry[]; lang: TitleLanguage }) {
  const { t, i18n } = useTranslation();

  const recap = monthRecap(entries);
  const picked = suggestions(entries);
  if (!recap && picked.length === 0) return null;

  return (
    /* No heading and no section of its own any more: the dashboard wraps this and
       the "what should I watch tonight" prompt in one decision area under a single
       heading. Two headings asking the same question read as two questions — and
       this one could render its heading over nothing at all, because the recap
       line survives when the suggestions do not. */
    <>
      {recap && (
        <p className="mb-4 text-[13.5px] leading-relaxed text-text-dim">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
            {new Intl.DateTimeFormat(i18n.language, { month: "long" }).format(recap.month)}
          </span>{" "}
          {[
            recap.finished > 0 && t("recap.finished", { count: recap.finished }),
            recap.started > 0 && t("recap.started", { count: recap.started }),
            recap.ongoing > 0 && t("recap.ongoing", { count: recap.ongoing }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {picked.length > 0 && (
        <ul className="grid gap-2.5 sm:grid-cols-3">
          {picked.map((suggestion) => (
            <SuggestionCard key={suggestion.entry.id} suggestion={suggestion} lang={lang} />
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * One title and the reason it is being raised. The whole card is the link, because
 * every suggestion resolves in the same place — the title's own page, where the
 * button that acts on it already lives. Nothing is actioned from here: a dashboard
 * that logs an episode behind a poster is a dashboard you cannot trust.
 */
function SuggestionCard({ suggestion, lang }: { suggestion: Suggestion; lang: TitleLanguage }) {
  const { t } = useTranslation();
  const { kind, entry, after } = suggestion;
  const isManga = entry.media.type === "manga";

  const reason =
    kind === "finish"
      ? t(isManga ? "recap.reason.finishManga" : "recap.reason.finish")
      : kind === "nextSeason"
        ? t("recap.reason.nextSeason", { name: after ? displayTitle(after.media, lang) : "" })
        : kind === "stale"
          ? t(isManga ? "recap.reason.staleManga" : "recap.reason.stale", {
              progress: entry.progress,
              when: relativeTime(entry.updated_at, t),
            })
          : t("recap.reason.rate");

  return (
    <li>
      <Link
        to={mediaHref(entry.media)}
        className="group flex items-center gap-3 rounded-control border border-line bg-surface p-2.5 transition-colors hover:border-control-line"
      >
        <div
          className="w-[38px] shrink-0 overflow-hidden rounded-[5px]"
          style={{ boxShadow: "var(--rim)" }}
        >
          <CoverImage media={entry.media} lang={lang} className="aspect-2/3 w-full" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-stamp-text">
            {t(`recap.kind.${kind}`)}
          </p>
          <p className="mt-[3px] truncate font-display text-[13px] font-semibold leading-[1.3] group-hover:text-stamp-text">
            {displayTitle(entry.media, lang)}
          </p>
          <p className="mt-[2px] truncate text-[11.5px] text-text-faint">{reason}</p>
        </div>
      </Link>
    </li>
  );
}
