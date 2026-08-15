import { Link } from "react-router-dom";

import type { Entry, TitleLanguage } from "../../lib/api-client";
import { displayTitle } from "../../lib/titles";
import { CoverImage } from "./CoverImage";
import { mediaHref } from "./Poster";

/**
 * One title per row: small cover, title, progress bar.
 *
 * The grid is the better way to browse; this is the better way to *scan*. On a
 * phone a 40-title grid is twenty screens of scrolling, and the artwork stops
 * helping once you already know what you are looking for.
 */
export function PosterRow({ entry, lang }: { entry: Entry; lang: TitleLanguage }) {
  const { media } = entry;
  const total = media.total_units;
  const pct = total ? Math.min(100, (entry.progress / total) * 100) : 0;
  const unit = total ? `${entry.progress} / ${total}` : `${entry.progress}`;

  return (
    <Link
      to={mediaHref(media)}
      className="group flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
    >
      <CoverImage media={media} lang={lang} className="h-14 w-[38px] shrink-0 rounded-[4px]" />
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-sm font-semibold group-hover:text-stamp-text">
          {displayTitle(media, lang)}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-[3px] flex-1 rounded-sm bg-ink-950/40">
            <div className="h-full rounded-sm bg-stamp" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular shrink-0 text-[11px] text-text-faint">{unit}</span>
        </div>
      </div>
      {entry.score ? (
        <span className="tabular shrink-0 text-xs text-text-dim">★ {entry.score}</span>
      ) : null}
    </Link>
  );
}
