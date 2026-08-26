import { useTranslation } from "react-i18next";

import type { Entry, Media } from "../../lib/api-client";
import { Spoiler } from "../ui/Spoiler";
import { cx } from "../../lib/cx";

/** Beyond this a list of episodes is a wall, so only the neighbourhood is shown. */
const AROUND = 12;

/**
 * The episodes of a title, with the ones ahead of the reader held back.
 *
 * Titles come from the provider and most shows have none — every episode is
 * listed by number either way, and a name is added where one is known. That is
 * why an empty `episode_titles` is unremarkable rather than an error.
 *
 * What is covered is decided by progress, not by anyone labelling anything: an
 * episode title is a one-line summary of an episode, so any title past where the
 * reader has got to is exactly the thing they came here not to read.
 */
export function EpisodeList({ media, entry }: { media: Media; entry: Entry | null }) {
  const { t } = useTranslation();

  const titles = media.episode_titles ?? [];
  const total = media.total_units ?? titles.length;
  if (total < 1 || titles.length === 0) return null;

  const progress = entry?.progress ?? 0;
  // A window around where they are: what they just watched, and what is next.
  const from = Math.max(0, progress - 3);
  const to = Math.min(total, from + AROUND);

  const rows = [];
  for (let n = from + 1; n <= to; n += 1) {
    const title = titles[n - 1] || "";
    const watched = n <= progress;
    rows.push({ n, title, watched });
  }

  return (
    <section aria-labelledby="episode-list" className="mb-8 sm:mb-14">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="episode-list" className="font-display text-[15px] font-bold tracking-[-0.01em]">
          {t("episodes.heading")}
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
          {t("episodes.range", { from: from + 1, to, total })}
        </p>
      </div>

      {/* The rule, once. Each row then needs only a control, not a sentence. */}
      <p className="mt-1 text-[12px] text-text-faint">{t("episodes.hidden")}</p>

      <div className="mt-3 border-t border-line" />

      <ul className="divide-y divide-line">
        {rows.map(({ n, title, watched }) => (
          <li key={n} className="flex items-baseline gap-3 py-2">
            <span
              className={cx(
                "tabular w-[42px] shrink-0 text-[12px]",
                watched ? "text-stamp-text" : "text-text-faint",
              )}
            >
              {n}
            </span>
            <span className="min-w-0 flex-1 text-[13px]">
              {!title ? (
                <span className="text-text-faint">{t("episodes.untitled")}</span>
              ) : watched ? (
                title
              ) : (
                // Past where they are: the title is the spoiler.
                <Spoiler compact reason={t("episodes.notReached")}>
                  <span className="block">{title}</span>
                </Spoiler>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
