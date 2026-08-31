import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../lib/cx";

/**
 * The page's own heading, and one line saying what the page is for.
 *
 * Three of the four primary routes had no `h1` at all — their titles were section
 * headings, so a screen reader met a page whose top-level heading was missing and
 * whose first landmark was a rail. The dashboard's only `h1` was the *hero's*
 * title, which announced the page as whatever happened to be playing.
 *
 * The subtitle is not decoration. Dashboard and library are both "your titles" to
 * anybody who has not used the app before, and the line under the heading is where
 * each one says which question it answers.
 */
export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-7">
      <h1 className="font-display text-[26px] font-bold tracking-[-0.01em]">{title}</h1>
      {children && <p className="mt-1.5 max-w-prose text-sm text-text-dim">{children}</p>}
    </header>
  );
}

/**
 * Section heading. Sentence case in the display face — the small uppercase mono
 * labels read as system chrome rather than as content headings.
 */
export function SectionHead({
  children,
  seeAll,
  onHide,
  hideLabel,
}: {
  children: ReactNode;
  seeAll?: { to: string; label: string };
  /** Present on a section the reader is allowed to put away for good. */
  onHide?: () => void;
  /** The control's accessible name, which has to name *which* section it hides. */
  hideLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <h2 className="font-display text-[19px] font-bold tracking-[-0.01em]">{children}</h2>
      <div className="flex shrink-0 items-baseline gap-4">
        {seeAll && (
          <Link
            to={seeAll.to}
            className="inline-flex items-center text-[12.5px] text-text-faint hover:text-stamp-text pointer-coarse:min-h-[44px]"
          >
            {seeAll.label} →
          </Link>
        )}
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            aria-label={hideLabel}
            className="inline-flex items-center text-[12.5px] text-text-faint hover:text-text pointer-coarse:min-h-[44px]"
          >
            {/* A drawn rule rather than a "✕": at this size the glyph's weight comes
                from whatever font the OS falls back to. */}
            <svg aria-hidden viewBox="0 0 24 24" width="13" height="13" fill="none"
                 stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Horizontal poster rail. Fixed 168px cells so covers keep a constant size no
 * matter how many are in the rail, and the row reads as one line of artwork.
 */
export function Rail({ children }: { children: ReactNode }) {
  return (
    <div className="rail flex gap-5 overflow-x-auto">
      {children}
    </div>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return <div className="w-[132px] shrink-0 sm:w-[168px]">{children}</div>;
}

/** The library grid. Same 168px cell, wrapped instead of scrolled. */
export function PosterGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "grid gap-x-5 gap-y-7",
        "grid-cols-[repeat(auto-fill,minmax(132px,1fr))]",
        "sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
