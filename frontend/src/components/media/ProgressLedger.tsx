import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cx } from "../../lib/cx";
import { LEDGER_MAX, milestoneAt, milestoneKey } from "../../features/media/milestones";

/**
 * Progress as a row of episodes rather than a percentage.
 *
 * A 3px bar answers "how far", but one episode out of twenty-four moves it four
 * pixels, so the most repeated action in the app produces the least visible
 * result. Drawn as notches, the same click fills a whole cell — the unit you
 * logged is the unit you see, which is the entire reward. It is the library-card
 * reading of the same number, and the gold already means progress everywhere else.
 *
 * Past a couple of cours the notches are thinner than the gaps between them, so a
 * long run keeps the bar: this degrades to exactly what it replaced.
 */
export function ProgressLedger({
  progress,
  total,
  isManga,
  className,
}: {
  progress: number;
  total: number | null;
  isManga: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const pulse = useLogPulse(progress);

  // An ongoing run with no announced length has no bar to fill — but it still
  // passes cour marks, so the caption below survives on its own.
  const pct = total ? Math.min(100, (progress / total) * 100) : 0;
  const milestone = milestoneAt(progress, total, isManga);
  const ledger = total != null && total <= LEDGER_MAX;

  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      {ledger ? (
        /* The notches shrink to `min-w-px` rather than to a legible floor on
           purpose: a flex child that refuses to shrink widens every ancestor, and
           the page ends up scrolling sideways on a phone. The width they actually
           get is settled by the caller giving the ledger a column wide enough. */
        <div aria-hidden className="flex min-w-0 items-end gap-[2px]">
          {Array.from({ length: total }, (_, i) => {
            const filled = i < progress;
            // Only the notch this click filled flares; `key` carries the pulse so
            // the animation restarts on every log rather than only the first.
            const isNew = filled && i === progress - 1 && pulse > 0;
            return (
              <span
                key={isNew ? `${i}-${pulse}` : i}
                className={cx(
                  "h-[6px] min-w-px flex-1 rounded-[1px] transition-colors",
                  filled ? "bg-stamp" : "bg-line",
                  isNew && "tick-land",
                )}
                style={{ transitionDuration: "var(--motion-lift)" }}
              />
            );
          })}
        </div>
      ) : total != null ? (
        <div aria-hidden className="h-[3px] w-full overflow-hidden rounded-pill bg-line">
          <div
            className="h-full rounded-pill bg-stamp transition-[width] ease-out"
            style={{ width: `${pct}%`, transitionDuration: "var(--motion-lift)" }}
          />
        </div>
      ) : null}

      {/* Announced politely: a milestone is worth hearing, but it arrives during a
          click the user already knows the result of. */}
      <p aria-live="polite" className="min-h-[13px]">
        {milestone && (
          <span
            key={`${milestone.kind}-${milestone.count ?? 0}-${pulse}`}
            className={cx(
              "font-mono text-[10px] uppercase tracking-[0.12em] text-stamp-text",
              pulse > 0 && "milestone-land",
            )}
          >
            {t(milestoneKey(milestone, isManga), { count: milestone.count ?? 0 })}
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * Counts logs made while this component is mounted, so the flare fires on a click
 * and never on arriving at a page that already stands at episode twelve.
 */
function useLogPulse(progress: number): number {
  const previous = useRef(progress);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (progress > previous.current) setPulse((n) => n + 1);
    previous.current = progress;
  }, [progress]);

  return pulse;
}
