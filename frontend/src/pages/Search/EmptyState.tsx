import { useTranslation } from "react-i18next";

import type { MediaType, TitleLanguage } from "../../lib/api-client";
import { useTrending } from "../../features/media/useMedia";
import { PosterGrid } from "../../components/layout/Rail";
import { Poster } from "../../components/media/Poster";
import { Icon, ICONS } from "../../components/ui/Icon";
import { PosterGridSkeleton } from "../../components/ui/Skeleton";

const ROW =
  "flex w-full items-center gap-3 py-3 text-left text-sm text-text-dim transition-colors " +
  "hover:text-text pointer-coarse:min-h-[44px]";

/**
 * What the page shows before anything is typed.
 *
 * Two things worth having: what this person searched before, and what everyone
 * is watching now. Neither is boxed in a container -- they are sections of the
 * page, the way the dashboard's rows are.
 */
export function SearchIdleState({
  type,
  lang,
  recent,
  onPick,
  onClearRecent,
}: {
  type: MediaType;
  lang: TitleLanguage;
  recent: string[];
  onPick: (query: string) => void;
  onClearRecent: () => void;
}) {
  const { t } = useTranslation();
  const trending = useTrending(type);
  const popular = trending.data ?? [];

  return (
    <div className="space-y-10">
      {recent.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[15px] font-bold tracking-[-0.01em]">
              {t("search.recent")}
            </h2>
            <button
              type="button"
              onClick={onClearRecent}
              className="text-[12px] text-text-faint transition-colors hover:text-stamp-text"
            >
              {t("search.clearRecent")}
            </button>
          </div>

          <ul className="divide-y divide-line border-t border-line">
            {recent.map((query) => (
              <li key={query}>
                <button type="button" onClick={() => onPick(query)} className={ROW}>
                  <Icon path={ICONS.history} size={15} className="text-text-faint" />
                  <span className="truncate">{query}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display mb-4 text-[15px] font-bold tracking-[-0.01em]">
          {t("search.popular")}
        </h2>
        {trending.isLoading ? (
          <PosterGridSkeleton />
        ) : popular.length === 0 ? (
          // A provider with no trending list is not an error worth a panel.
          <p className="text-sm text-text-dim">{t("search.prompt")}</p>
        ) : (
          <PosterGrid>
            {popular.map((media) => (
              <Poster
                key={`${media.provider}-${media.provider_id}`}
                media={media}
                lang={lang}
                meta={[media.format, media.season_year].filter(Boolean).join(" · ")}
              />
            ))}
          </PosterGrid>
        )}
      </section>
    </div>
  );
}
