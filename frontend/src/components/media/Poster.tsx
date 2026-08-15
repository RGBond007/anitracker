import { Link } from "react-router-dom";

import type { Entry, Media, TitleLanguage } from "../../lib/api-client";
import { cx } from "../../lib/cx";
import { displayTitle } from "../../lib/titles";
import { CoverImage } from "./CoverImage";

export function mediaHref(media: Media): string {
  return `/media/${media.provider}/${media.provider_id}?type=${media.type}`;
}

/**
 * The single card used by every surface: rails, the library grid, search results.
 *
 * The frame is a fixed 2:3 so a row of covers is one clean line of artwork, and
 * the caption sits *outside* the frame rather than overlaying it — the artwork is
 * the thing worth looking at, so nothing is printed on top of it.
 */
export function Poster({
  media,
  lang,
  entry,
  meta,
}: {
  media: Media;
  lang: TitleLanguage;
  entry?: Entry;
  /** Caption's second line. Defaults to the progress fraction when tracked. */
  meta?: string;
}) {
  const title = displayTitle(media, lang);
  const total = media.total_units;
  const pct = entry && total ? Math.min(100, (entry.progress / total) * 100) : 0;

  const caption =
    meta ??
    (entry
      ? total
        ? `${entry.progress}/${total}`
        : media.type === "manga"
          ? `ch. ${entry.progress}`
          : `${entry.progress} ep`
      : [media.format, media.season_year].filter(Boolean).join(" · "));

  return (
    <Link to={mediaHref(media)} className="group block w-full" aria-label={title}>
      <div
        className={cx(
          "relative aspect-2/3 w-full overflow-hidden rounded-poster",
          "transition-transform ease-out will-change-transform",
          "motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:scale-[1.02]",
        )}
        style={{ boxShadow: "var(--shadow-poster)", transitionDuration: "var(--motion-lift)" }}
      >
        {/* Fills the 2:3 frame. Sizing rather than `absolute inset-0` keeps
            CoverImage's own `relative` root, which its <img> anchors to. */}
        <CoverImage media={media} lang={lang} className="h-full w-full" />

        {/* Hairline rim: stops dark artwork from bleeding into a dark page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-poster"
          style={{ boxShadow: "var(--rim)" }}
        />

        {entry && pct > 0 && (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-ink-950/40">
            <div className="h-full bg-stamp" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="mt-2.5">
        {/* Two lines are reserved whether or not the title needs them, so the
            progress line below sits on one baseline across a row of covers. */}
        <p className="font-display line-clamp-2 text-[13px] sm:min-h-[2.6em] font-semibold leading-[1.3] group-hover:text-stamp-text">
          {title}
        </p>
        {caption && <p className="tabular mt-[3px] text-[11px] text-text-faint">{caption}</p>}
      </div>
    </Link>
  );
}

/** The trailing cell on a rail: same footprint, dashed, no artwork. */
export function AddPoster({ label, to = "/search" }: { label: string; to?: string }) {
  return (
    <Link to={to} className="group block w-full">
      <div
        className={cx(
          "flex aspect-2/3 w-full items-center justify-center rounded-poster",
          "border border-dashed border-line text-text-faint transition-colors",
          "group-hover:border-stamp group-hover:text-stamp-text",
        )}
      >
        <span aria-hidden className="font-display text-[26px] font-medium leading-none">
          +
        </span>
      </div>
      <p className="font-display mt-2.5 text-[13px] font-semibold leading-[1.3] text-text-faint group-hover:text-stamp-text">
        {label}
      </p>
    </Link>
  );
}
