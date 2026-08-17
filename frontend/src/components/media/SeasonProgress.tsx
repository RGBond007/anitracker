import { useTranslation } from "react-i18next";

import type { Entry } from "../../lib/api-client";
import { useIncrementEntry } from "../../features/media/useMedia";
import { Button } from "../ui/Button";
import { useStatusLabel } from "./statusLabels";

/**
 * This season's own progress, under this season's own artwork.
 *
 * It sits beside the cover rather than in the entry form below because progress is
 * the one number that has to be read at a glance — and on a show with seasons it is
 * the number that changes when the season does, so the two belong to the same
 * column. Editing everything else stays in the form.
 */
export function SeasonProgress({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  const statusLabel = useStatusLabel();
  const increment = useIncrementEntry();

  const total = entry.media.total_units;
  const pct = total ? Math.min(100, (entry.progress / total) * 100) : 0;
  const finished = total != null && entry.progress >= total;

  return (
    <div className="rounded-control border border-line bg-surface px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">
          {t("entry.progress")}
        </p>
        <p className="text-[11px] text-text-dim">{statusLabel(entry.status, entry.media.type)}</p>
      </div>

      <p className="tabular mt-1 text-[17px] leading-none">
        <span className="font-semibold">{entry.progress}</span>
        {total ? <span className="text-text-faint"> / {total}</span> : null}
      </p>

      <div aria-hidden className="mt-2.5 h-[3px] overflow-hidden rounded-pill bg-line">
        <div
          className="h-full rounded-pill bg-stamp transition-[width] ease-out"
          style={{ width: `${pct}%`, transitionDuration: "var(--motion-lift)" }}
        />
      </div>

      <Button
        variant="ghost"
        aria-label={t("season.increment")}
        className="mt-3 w-full px-2 py-2 text-[13px]"
        disabled={increment.isPending || finished}
        onClick={() => increment.mutate(entry.id)}
      >
        {t("season.plusOne")}
      </Button>
    </div>
  );
}
