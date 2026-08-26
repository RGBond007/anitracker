import { cx } from "../../lib/cx";

/**
 * The line icons, drawn rather than typed.
 *
 * A glyph like "✕" or "⋯" takes its weight, size and baseline from whatever font
 * the OS falls back to, so every icon in the app is a stroked path on a 24-unit
 * grid instead — same convention the navigation has always used, collected here
 * once so the pencil in the viewing log and the chevron in a select are the same
 * drawing at the same weight.
 */
export const ICONS = {
  chevronDown: "m6 9 6 6 6-6",
  pencil: "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z",
  plus: "M12 5v14M5 12h14",
  check: "m20 6-11 11-5-5",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  sliders: "M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4M14 4v4M6 10v4M12 16v4",
  history: "M12 8v4l3 2M3.5 12a8.5 8.5 0 1 0 2.6-6.1M6 3v3h3",
  close: "m6 6 12 12M18 6 6 18",
  /* Two heads and two shoulders: a group, at the same weight as the rest. */
  friends: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 5.2a3.25 3.25 0 0 1 0 6.1",
  /* Two upright volumes and a third leaning — a shelf, not a stack of paper. */
  library: "M4 4v16M9 4v16M14.5 5.5 19 19",
  /* Paper plane, drawn as the outline plus the fold: two subpaths on the same
     24-unit grid, so it carries the same weight as the pencil beside it. */
  send: "M21.5 2.5 2 9.5l8 3 3 8 8.5-18ZM10 12.5l11.5-10",
  /* Three dots: zero-length segments with round caps, so they scale with the
     stroke weight instead of needing their own radius. */
  more: "M12 5h.01M12 12h.01M12 19h.01",
};

export function Icon({
  path,
  size = 16,
  strokeWidth = 1.75,
  className,
}: {
  path: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("shrink-0", className)}
    >
      <path d={path} />
    </svg>
  );
}
