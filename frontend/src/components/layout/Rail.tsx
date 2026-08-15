import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../lib/cx";

/**
 * Section heading. Sentence case in the display face — the small uppercase mono
 * labels read as system chrome rather than as content headings.
 */
export function SectionHead({
  children,
  seeAll,
}: {
  children: ReactNode;
  seeAll?: { to: string; label: string };
}) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <h2 className="font-display text-[19px] font-bold tracking-[-0.01em]">{children}</h2>
      {seeAll && (
        <Link
          to={seeAll.to}
          className="inline-flex items-center text-[12.5px] text-text-faint hover:text-stamp-text pointer-coarse:min-h-[44px]"
        >
          {seeAll.label} →
        </Link>
      )}
    </div>
  );
}

/**
 * Horizontal poster rail. Fixed 168px cells so covers keep a constant size no
 * matter how many are in the rail, and the row reads as one line of artwork.
 */
export function Rail({ children }: { children: ReactNode }) {
  return (
    <div className="rail flex gap-5 overflow-x-auto pb-1.5">
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
