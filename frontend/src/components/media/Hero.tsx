import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import type { Entry, TitleLanguage } from "../../lib/api-client";
import { displayTitle } from "../../lib/titles";
import { Button } from "../ui/Button";
import { mediaHref } from "./Poster";

/**
 * The one thing you came back for, full-bleed.
 *
 * The banner art is scrimmed twice — left-to-right so the text always has a dark
 * ground under it, and bottom-up so the hero dissolves into the page instead of
 * ending on a hard edge. Titles without a banner fall back to a flat gradient
 * rather than a broken image.
 */
export function Hero({
  entry,
  lang,
  onIncrement,
}: {
  entry: Entry;
  lang: TitleLanguage;
  onIncrement: () => void;
}) {
  const { t } = useTranslation();
  const { media } = entry;
  const title = displayTitle(media, lang);
  const total = media.total_units;
  const pct = total ? Math.min(100, (entry.progress / total) * 100) : 0;
  const unit = media.type === "anime" ? t("hero.episode") : t("hero.chapter");

  const scrims =
    "linear-gradient(90deg, rgb(var(--scrim)/1) 5%, rgb(var(--scrim)/0.65) 45%, rgb(var(--scrim)/0.15) 75%)," +
    "linear-gradient(to top, rgb(var(--scrim)/1) 0%, rgb(var(--scrim)/0.1) 40%)";

  return (
    <section className="relative mb-8 h-[300px] overflow-hidden sm:mb-14 sm:h-[420px]">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: media.banner_url
            ? `${scrims}, url(${media.banner_url})`
            : `${scrims}, linear-gradient(135deg, var(--gutter), var(--ink-950) 70%)`,
        }}
      />

      <div className="wrap relative flex h-full flex-col justify-end pb-7 sm:pb-11">
        <p className="font-mono mb-3.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-stamp-text">
          <span aria-hidden className="h-px w-4 bg-stamp-text" />
          {t("dashboard.continue")}
        </p>

        <h1 className="font-display mb-3 max-w-[600px] text-[32px] font-bold leading-[1.05] tracking-[-0.02em] sm:text-[44px]">
          {title}
        </h1>

        <p className="mb-6 flex flex-wrap gap-x-4 text-sm text-text-dim">
          <span>
            {[media.format, total && `${total} ${t("hero.episodes")}`].filter(Boolean).join(" · ")}
          </span>
          {media.season_year && <span>{media.season_year}</span>}
          {entry.score != null && entry.score > 0 && <span>★ {entry.score.toFixed(1)}</span>}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" onClick={onIncrement}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            {t("hero.updateProgress")}
          </Button>
          <Link to={mediaHref(media)}>
            <Button variant="ghost">{t("hero.viewDetails")}</Button>
          </Link>
        </div>

        <div className="mt-[22px] flex w-[280px] max-w-full items-center gap-2.5">
          <div className="h-[3px] flex-1 rounded-sm bg-text/20">
            <div className="h-full rounded-sm bg-stamp" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular whitespace-nowrap text-[11.5px] text-text-dim">
            {t("hero.progress", { unit, progress: entry.progress, total: total ?? "—" })}
          </span>
        </div>
      </div>
    </section>
  );
}
