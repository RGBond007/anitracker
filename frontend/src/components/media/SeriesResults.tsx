import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { Media, TitleLanguage } from "../../lib/api-client";
import { useAddEntry, useEntryForMedia } from "../../features/media/useMedia";
import { baseTitle } from "../../lib/franchise";
import { displayTitle } from "../../lib/titles";
import { PosterGrid } from "../layout/Rail";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { CoverImage } from "./CoverImage";
import { Poster, mediaHref } from "./Poster";

/** A show and everything of it that the search turned up, oldest first. */
interface SearchGroup {
  key: string;
  title: string;
  /** The show itself: the earliest thing in the group. */
  main: Media;
  entries: Media[];
}

/** Sorts undated announcements last, where an unaired season belongs. */
const year = (media: Media) => media.season_year ?? 9999;

/**
 * Collapse a flat result list into one card per show.
 *
 * Searching "attack on titan" returns six rows of the same show, which buries every
 * other match. Grouping is by name rather than by the season chain because these
 * results come straight from the provider: nothing here has been cached yet, so
 * there is no `root_provider_id` to group on and no season number to sort by. The
 * name a provider gives a later season always contains the show's name, which is
 * what `baseTitle` strips back to.
 */
function groupResults(results: Media[], lang: TitleLanguage): SearchGroup[] {
  const groups = new Map<string, Media[]>();
  for (const media of results) {
    const key = baseTitle(displayTitle(media, lang)).toLowerCase();
    const bucket = groups.get(key);
    if (bucket) bucket.push(media);
    else groups.set(key, [media]);
  }

  // Groups keep the provider's relevance order; inside one, release order decides
  // which is the main series — the first season, not whichever matched best.
  return [...groups.entries()].map(([key, entries]) => {
    const ordered = [...entries].sort((a, b) => year(a) - year(b));
    return {
      key,
      title: baseTitle(displayTitle(ordered[0], lang)),
      main: ordered[0],
      entries: ordered,
    };
  });
}

export function SeriesResults({ results, lang }: { results: Media[]; lang: TitleLanguage }) {
  const { t } = useTranslation();
  const [chooserFor, setChooserFor] = useState<SearchGroup | null>(null);
  const groups = groupResults(results, lang);

  return (
    <>
      <PosterGrid>
        {groups.map((group) => (
          <div key={group.key}>
            <Poster
              media={group.main}
              lang={lang}
              meta={[group.main.format, group.main.season_year].filter(Boolean).join(" · ")}
            />
            {group.entries.length > 1 && (
              <button
                type="button"
                onClick={() => setChooserFor(group)}
                className="mt-2 w-full rounded-control border border-line px-2 py-1.5 text-[11px] text-text-dim transition-colors hover:border-control-line hover:text-text"
              >
                {t("search.chooseEntry", { count: group.entries.length })}
              </button>
            )}
          </div>
        ))}
      </PosterGrid>

      {chooserFor && (
        <Modal title={chooserFor.title} onClose={() => setChooserFor(null)}>
          <p className="mb-3 text-[12.5px] text-text-dim">{t("search.chooseHint")}</p>
          <ul className="divide-y divide-line">
            {chooserFor.entries.map((media) => (
              <ChoosableEntry key={`${media.provider}-${media.provider_id}`} media={media} lang={lang} />
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}

/** One row of the chooser: what it is, and a button to put it on the list. */
function ChoosableEntry({ media, lang }: { media: Media; lang: TitleLanguage }) {
  const { t } = useTranslation();
  const add = useAddEntry();
  const tracked = useEntryForMedia(media.provider, media.provider_id);

  return (
    <li className="flex items-center gap-3 py-2.5">
      <CoverImage media={media} lang={lang} className="h-[54px] w-[36px] shrink-0 rounded-[5px]" />
      <div className="min-w-0 flex-1">
        <Link
          to={mediaHref(media)}
          className="font-display line-clamp-1 text-[13px] font-semibold hover:text-stamp-text"
        >
          {displayTitle(media, lang)}
        </Link>
        <p className="tabular mt-0.5 text-[11px] text-text-faint">
          {[
            media.format,
            media.season_year,
            media.total_units
              ? t(media.type === "manga" ? "season.chapters" : "season.episodes", {
                  n: media.total_units,
                })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {tracked.data ? (
        <span className="shrink-0 text-[11.5px] text-text-faint">{t("search.onYourList")}</span>
      ) : (
        <Button
          variant="ghost"
          className="shrink-0 px-3 py-1.5 text-[12px]"
          disabled={add.isPending}
          onClick={() =>
            add.mutate({
              provider: media.provider,
              provider_id: media.provider_id,
              type: media.type,
              status: "planned",
              progress: 0,
            })
          }
        >
          {t("search.addThis")}
        </Button>
      )}
    </li>
  );
}
