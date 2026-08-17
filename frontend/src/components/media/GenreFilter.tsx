import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Media } from "../../lib/api-client";
import { cx } from "../../lib/cx";
import { Chip } from "../ui/Button";

/** Enough to cover what a search usually turns up, without becoming a wall. */
const VISIBLE = 8;

/**
 * Narrow a set of results by the categories actually in it.
 *
 * The chips are built from the results rather than from a fixed list of every
 * genre the provider knows: a filter offering "Mecha" on a page with no mecha in
 * it is a promise of nothing. Each chip carries the number of titles it would
 * leave, counted against the *other* chips already on, so nothing on offer is a
 * dead end and the numbers stay true as the selection narrows.
 *
 * Selecting more than one narrows rather than widens — "Action and Comedy", not
 * "Action or Comedy" — which is what a reader expects of a filter they are adding
 * to in order to cut a list down.
 */
export function GenreFilter({
  results,
  selected,
  onChange,
}: {
  results: Media[];
  selected: string[];
  onChange: (genres: string[]) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const countFor = (genre: string) => {
    const others = selected.filter((g) => g !== genre);
    return results.filter(
      (media) => media.genres.includes(genre) && others.every((o) => media.genres.includes(o)),
    ).length;
  };

  const categories = [...new Set(results.flatMap((media) => media.genres))]
    .map((genre) => ({ genre, count: countFor(genre), on: selected.includes(genre) }))
    // A category that is on stays listed whatever it counts — turning it off has to
    // remain possible. The rest earn their place by how much they account for.
    .filter((c) => c.on || c.count > 0)
    .sort(
      (a, b) =>
        Number(b.on) - Number(a.on) || b.count - a.count || a.genre.localeCompare(b.genre),
    );

  if (categories.length === 0) return null;

  const shown = expanded ? categories : categories.slice(0, VISIBLE);
  const hidden = categories.length - shown.length;

  const toggle = (genre: string) =>
    onChange(
      selected.includes(genre) ? selected.filter((g) => g !== genre) : [...selected, genre],
    );

  return (
    <div role="group" aria-label={t("search.categoriesLabel")} className="flex flex-wrap gap-2">
      {shown.map(({ genre, count, on }) => (
        <Chip key={genre} active={on} onClick={() => toggle(genre)}>
          {genre}
          <span className={cx("tabular ml-1.5", on ? "text-bg/60" : "text-text-faint")}>
            {count}
          </span>
        </Chip>
      ))}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-pill px-2.5 py-[7px] text-[12.5px] text-text-dim transition-colors hover:text-text"
        >
          {t("search.moreCategories", { count: hidden })}
        </button>
      )}

      {expanded && categories.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-pill px-2.5 py-[7px] text-[12.5px] text-text-dim transition-colors hover:text-text"
        >
          {t("search.fewerCategories")}
        </button>
      )}

      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-pill px-2.5 py-[7px] text-[12.5px] text-text-dim transition-colors hover:text-stamp-text"
        >
          {t("search.clearCategories")}
        </button>
      )}
    </div>
  );
}
