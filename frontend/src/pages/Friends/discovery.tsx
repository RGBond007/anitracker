import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { Media, PublicUser, Recommendation, TitleLanguage } from "../../lib/api-client";
import { useAddEntry, useEntryForMedia } from "../../features/media/useMedia";
import { useFriendsWatching, useRecommendations } from "../../features/social/useSocial";
import { cx } from "../../lib/cx";
import { displayTitle } from "../../lib/titles";
import { PosterGrid, Rail, RailItem } from "../../components/layout/Rail";
import { CoverImage } from "../../components/media/CoverImage";
import { Poster, mediaHref } from "../../components/media/Poster";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Icon, ICONS } from "../../components/ui/Icon";

/** How many of a rail's items show before "See all" opens the rest. */
const RAIL_VISIBLE = 8;

/**
 * Put a suggested title on the plan-to-watch list.
 *
 * It asks whether the title is already tracked rather than assuming it is not:
 * the recommendation lists exclude what is on your list, but they are cached, so
 * a card can outlive the fact it is reporting. Knowing the answer is also what
 * keeps this from ever sending the second request that the API would refuse.
 */
function AddToPlan({ media, compact = false }: { media: Media; compact?: boolean }) {
  const { t } = useTranslation();
  const tracked = useEntryForMedia(media.provider, media.provider_id);
  const add = useAddEntry();
  const [justAdded, setJustAdded] = useState(false);

  const onList = Boolean(tracked.data) || justAdded;

  if (onList) {
    return (
      <span
        role="status"
        className={cx(
          "inline-flex items-center gap-1.5 text-[12.5px] text-text-dim",
          compact ? "px-1" : "px-1 py-2",
        )}
      >
        <Icon path={ICONS.check} size={14} className="text-stamp" />
        {justAdded ? t("friends.addedToPlan") : t("friends.onYourList")}
      </span>
    );
  }

  return (
    <Button
      variant={compact ? "ghost" : "stamp"}
      className={compact ? "px-2.5 py-1.5 text-[12px]" : "px-4 py-2.5 text-[13px]"}
      disabled={add.isPending || tracked.isLoading}
      onClick={() =>
        add.mutate(
          {
            provider: media.provider,
            provider_id: media.provider_id,
            type: media.type,
            status: "planned",
            progress: 0,
          },
          { onSuccess: () => setJustAdded(true) },
        )
      }
    >
      {t("friends.addToPlan")}
    </Button>
  );
}

/** The overlapping faces of the people who vouched for something. */
function FanStack({ fans, size = 26 }: { fans: PublicUser[]; size?: number }) {
  if (fans.length === 0) return null;
  return (
    <div className="flex items-center">
      {fans.slice(0, 4).map((fan, index) => (
        <span
          key={fan.id}
          // Overlapped, and each one lifted above the next so the stack reads
          // left-to-right rather than as a pile.
          style={{ marginLeft: index === 0 ? 0 : -size / 3, zIndex: 4 - index }}
          className="relative rounded-full ring-2 ring-bg"
        >
          <Avatar user={fan} size={size} decorative />
        </span>
      ))}
    </div>
  );
}

function metaLine(media: Media, t: (k: string, o?: Record<string, unknown>) => string): string {
  return [
    media.format,
    media.total_units
      ? t(media.type === "manga" ? "season.chapters" : "season.episodes", { n: media.total_units })
      : null,
    media.season_year,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The one title the viewer's friends were most sure about.
 *
 * Flat and editorial: a poster, a paragraph and one action, separated from the
 * rest of the page by space and a rule rather than boxed into a card. The claim
 * it makes is checkable -- the faces are the people who rated it, and the line
 * under them says exactly what they did.
 */
export function TrustedPick({ lang }: { lang: TitleLanguage }) {
  const { t } = useTranslation();
  const { data } = useRecommendations();
  const featured = data?.featured;

  if (!featured) return null;

  const { media, fans } = featured;
  const title = displayTitle(media, lang);

  return (
    <section aria-labelledby="trusted-pick" className="border-b border-line pb-8">
      <h2
        id="trusted-pick"
        className="font-mono mb-4 text-[11px] uppercase tracking-[0.12em] text-text-dim"
      >
        {t("friends.trustedHeading")}
      </h2>

      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        <Link
          to={mediaHref(media)}
          aria-label={title}
          className="w-[128px] shrink-0 self-start sm:w-[150px]"
        >
          <CoverImage media={media} lang={lang} className="aspect-2/3 w-full rounded-poster" />
        </Link>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-bold leading-tight tracking-tight">
            <Link to={mediaHref(media)} className="hover:text-stamp-text">
              {title}
            </Link>
          </h3>

          <p className="tabular mt-1.5 text-[12.5px] text-text-dim">
            {metaLine(media, t)}
            {media.average_score ? (
              <>
                <span aria-hidden> · </span>
                <span className="text-text-faint">
                  {t("detail.communityScore")} {media.average_score}%
                </span>
              </>
            ) : null}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <FanStack fans={fans} />
            <p className="text-[13px] text-text">
              {t("friends.ratedItHighly", { count: fans.length })}
            </p>
          </div>

          <div className="mt-5">
            <AddToPlan media={media} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Who is part-way through what.
 *
 * The poster opens the title and the name opens the person, because those are
 * two different questions and a row that answered only one of them would send
 * everyone to the wrong place half the time.
 */
export function FriendsWatching({ lang }: { lang: TitleLanguage }) {
  const { t } = useTranslation();
  const { data } = useFriendsWatching();
  const [showAll, setShowAll] = useState(false);

  const rows = data ?? [];
  if (rows.length === 0) return null;

  const shown = showAll ? rows : rows.slice(0, RAIL_VISIBLE);

  const cell = (item: (typeof rows)[number]) => {
    const { entry, user } = item;
    const season = entry.media.season_number;
    const progress = entry.media.total_units
      ? `${entry.progress}/${entry.media.total_units}`
      : `${entry.progress}`;

    return (
      <>
        <Poster
          media={entry.media}
          lang={lang}
          meta={[season ? t("season.number", { n: season }) : null, progress]
            .filter(Boolean)
            .join(" · ")}
        />
        <Link
          to={`/u/${user.username}`}
          className="mt-2 flex items-center gap-2 text-text-dim transition-colors hover:text-text pointer-coarse:min-h-[44px]"
        >
          <Avatar user={user} size={24} decorative />
          <span className="truncate text-[12px]">{user.username}</span>
        </Link>
      </>
    );
  };

  return (
    <section aria-labelledby="friends-watching" className="border-b border-line pb-8">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2
          id="friends-watching"
          className="font-display text-[19px] font-bold tracking-[-0.01em]"
        >
          {t("friends.watchingHeading")}
        </h2>
        {rows.length > RAIL_VISIBLE && (
          <button
            type="button"
            onClick={() => setShowAll((on) => !on)}
            className="text-[12.5px] text-text-faint transition-colors hover:text-stamp-text"
          >
            {showAll ? t("friends.showFewer") : t("common.seeAll")}
          </button>
        )}
      </div>

      {/* A rail while it is a row, a grid once it is a list. Both are the
          library's own poster layout -- nothing here is boxed in a card. */}
      {showAll ? (
        <PosterGrid>
          {shown.map((item) => (
            <div key={`${item.user.id}-${item.entry.id}`}>{cell(item)}</div>
          ))}
        </PosterGrid>
      ) : (
        <Rail>
          {shown.map((item) => (
            <RailItem key={`${item.user.id}-${item.entry.id}`}>{cell(item)}</RailItem>
          ))}
        </Rail>
      )}
    </section>
  );
}

/**
 * "Because you liked ..." -- suggestions with their reasoning attached.
 *
 * The reason is the genres the title actually shares with the viewer's own
 * favourite, so the line under each poster is the same fact the ranking used.
 * Nothing is inferred by a model and nothing claims to be.
 */
export function PersonalPicks({ lang }: { lang: TitleLanguage }) {
  const { t } = useTranslation();
  const { data } = useRecommendations();

  const because = data?.because;
  const picks = data?.personal ?? [];
  if (!because || picks.length === 0) return null;

  return (
    <section aria-labelledby="personal-picks" className="pb-2">
      <h2 id="personal-picks" className="font-display mb-1 text-[19px] font-bold tracking-[-0.01em]">
        {t("friends.becauseYouLiked", { title: displayTitle(because, lang) })}
      </h2>
      <p className="mb-4 text-[12.5px] text-text-faint">{t("friends.becauseHint")}</p>

      <PosterGrid>
        {picks.map((pick) => (
          <PersonalPick key={pick.media.provider_id} pick={pick} lang={lang} />
        ))}
      </PosterGrid>
    </section>
  );
}

function PersonalPick({ pick, lang }: { pick: Recommendation; lang: TitleLanguage }) {
  const { t } = useTranslation();
  const { media, shared_genres } = pick;

  return (
    <div className="group">
      <Poster
        media={media}
        lang={lang}
        meta={
          media.average_score
            ? `${media.format ?? ""} ${media.average_score}%`.trim()
            : (media.format ?? "")
        }
      />

      {/* The reason, in the reader's own words: the genres it has in common. */}
      {shared_genres.length > 0 && (
        <p className="mt-1 text-[11.5px] leading-snug text-text-dim">
          {t("friends.sharedThemes", { genres: shared_genres.join(", ") })}
        </p>
      )}

      {/* Quiet until wanted: revealed on hover, on keyboard focus, and always
          where there is no pointer to hover with. */}
      <div
        className={cx(
          "mt-1.5 transition-opacity",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          "pointer-coarse:opacity-100",
        )}
      >
        <AddToPlan media={media} compact />
      </div>
    </div>
  );
}
