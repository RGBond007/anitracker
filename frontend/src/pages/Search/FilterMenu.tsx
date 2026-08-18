import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cx } from "../../lib/cx";
import { Button } from "../../components/ui/Button";
import { Icon, ICONS } from "../../components/ui/Icon";
import { Select } from "../../components/ui/Input";
import {
  NO_FILTERS,
  activeCount,
  type FacetOptions,
  type SearchFilters,
  type SortOrder,
} from "./filters";

const SORTS: SortOrder[] = ["relevance", "newest", "score", "title"];

/**
 * The filters, behind a button.
 *
 * Off the page until asked for: a search page's job is the field and the
 * results, and five permanently visible controls would make it a form. The
 * panel holds a draft, so nothing moves under the reader until "Apply" -- which
 * is also what keeps a set of choices from firing five re-renders of the grid.
 */
export function FilterMenu({
  filters,
  facets,
  onApply,
}: {
  filters: SearchFilters;
  facets: FacetOptions;
  onApply: (next: SearchFilters) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const count = activeCount(filters);

  // Reopening shows what is actually applied, not a draft abandoned last time.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("select, button")?.focus();
  }, [open]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const commit = (next: SearchFilters) => {
    onApply(next);
    close();
  };

  const toggleGenre = (genre: string) =>
    setDraft((current) => ({
      ...current,
      genres: current.genres.includes(genre)
        ? current.genres.filter((g) => g !== genre)
        : [...current.genres, genre],
    }));

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((on) => !on)}
        className={cx(
          // Matches the search field's height so the two sit on one line.
          "inline-flex h-[46px] items-center gap-2 rounded-control border px-3.5 text-sm",
          "transition-colors",
          count > 0
            ? "border-stamp/60 text-text"
            : "border-control-line text-text-dim hover:border-text-dim hover:text-text",
        )}
      >
        <Icon path={ICONS.sliders} size={15} />
        {t("search.filters")}
        {count > 0 && (
          <span className="tabular rounded-pill bg-stamp px-1.5 text-[11px] font-semibold text-ink-950">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t("search.filters")}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
          className={cx(
            "absolute right-0 top-[calc(100%+8px)] z-40 w-[min(20rem,calc(100vw-2.5rem))]",
            "space-y-4 rounded-control border border-line bg-surface p-4",
          )}
        >
          <Facet label={t("search.format")}>
            <Select
              value={draft.format ?? ""}
              onChange={(e) => setDraft({ ...draft, format: e.target.value || null })}
            >
              <option value="">{t("search.anyFormat")}</option>
              {facets.formats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </Select>
          </Facet>

          <Facet label={t("search.status")}>
            <Select
              value={draft.status ?? ""}
              onChange={(e) => setDraft({ ...draft, status: e.target.value || null })}
            >
              <option value="">{t("search.anyStatus")}</option>
              {facets.statuses.map((status) => (
                <option key={status} value={status}>
                  {t(`mediaStatus.${status}`, { defaultValue: status })}
                </option>
              ))}
            </Select>
          </Facet>

          <Facet label={t("search.year")}>
            <Select
              value={draft.year ? String(draft.year) : ""}
              onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) || null })}
            >
              <option value="">{t("search.anyYear")}</option>
              {facets.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </Facet>

          <Facet label={t("search.sort")}>
            <Select
              value={draft.sort}
              onChange={(e) => setDraft({ ...draft, sort: e.target.value as SortOrder })}
            >
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`search.sort_${sort}`)}
                </option>
              ))}
            </Select>
          </Facet>

          {facets.genres.length > 0 && (
            <Facet label={t("search.genre")}>
              {/* Capped in height: a broad search can carry twenty genres, and a
                  panel that grows past the fold cannot show its own buttons. */}
              <div className="-mx-1 max-h-[152px] overflow-y-auto px-1">
                <div className="flex flex-wrap gap-1.5">
                  {facets.genres.map((genre) => {
                    const on = draft.genres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleGenre(genre)}
                        className={cx(
                          "rounded-pill border px-2.5 py-1 text-[12px] transition-colors",
                          on
                            ? "border-text bg-text font-medium text-bg"
                            : "border-line text-text-dim hover:border-control-line hover:text-text",
                        )}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Facet>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setDraft(NO_FILTERS)}
              className="rounded-control px-2 py-2 text-[13px] text-text-dim transition-colors hover:text-text"
            >
              {t("search.reset")}
            </button>
            <Button variant="stamp" className="px-4 py-2 text-[13px]" onClick={() => commit(draft)}>
              {t("search.applyFilters")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Facet({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono block text-[10px] uppercase tracking-[0.1em] text-text-dim">
        {label}
      </span>
      {children}
    </label>
  );
}
