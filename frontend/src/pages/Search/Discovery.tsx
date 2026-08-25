import { useTranslation } from "react-i18next";

import type { TitleLanguage } from "../../lib/api-client";
import type { Pick } from "../../features/discovery/picks";
import { discoverySections, pickKey } from "../../features/discovery/picks";
import { useDismissed } from "../../features/discovery/dismissed";
import { useEntries } from "../../features/media/useMedia";
import { Rail, RailItem } from "../../components/layout/Rail";
import { Poster } from "../../components/media/Poster";
import { Icon, ICONS } from "../../components/ui/Icon";
import { cx } from "../../lib/cx";

/**
 * Something to watch, for the reader who came here without a title in mind.
 *
 * It sits under the search box because that is where someone lands when they do
 * not know what they want, and it draws entirely on their own library: every row
 * is a rule over entries the app already has, and every poster carries the line
 * that put it there. A section with nothing to say is absent rather than empty.
 */
export function Discovery({ lang }: { lang: TitleLanguage }) {
  const { t } = useTranslation();
  const { dismissed, count, dismiss, restore } = useDismissed();

  // The whole list, unfiltered: these rules read across every status, and the
  // default sort makes this the same cache entry the library already holds.
  const { data } = useEntries({ sort: "updated" });
  const sections = discoverySections(data ?? [], dismissed);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-9">
      {sections.map((section) => (
        <section key={section.kind}>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[15px] font-bold tracking-[-0.01em]">
              {t(`discover.${section.kind}.heading`)}
            </h2>
          </div>
          <Rail>
            {section.picks.map((pick) => (
              <RailItem key={pick.entry.id}>
                <PickCard pick={pick} lang={lang} onDismiss={() => dismiss(pickKey(pick.entry))} />
              </RailItem>
            ))}
          </Rail>
        </section>
      ))}

      {count > 0 && (
        /* Dismissals are reversible and the way back is in plain sight. A control
           that hides things permanently with no undo is one people stop using. */
        <p className="text-[12px] text-text-faint">
          {t("discover.dismissedCount", { count })}{" "}
          <button
            type="button"
            onClick={restore}
            className="underline decoration-line underline-offset-2 transition-colors hover:text-stamp-text"
          >
            {t("discover.restore")}
          </button>
        </p>
      )}
    </div>
  );
}

function PickCard({
  pick,
  lang,
  onDismiss,
}: {
  pick: Pick;
  lang: TitleLanguage;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const unit = pick.entry.media.type === "manga" ? "Manga" : "";

  return (
    <div className="group/pick relative">
      <Poster
        media={pick.entry.media}
        entry={pick.kind === "onHold" ? pick.entry : undefined}
        lang={lang}
        meta={t(`discover.${pick.kind}.reason${unit}`, pick.reason)}
      />
      {/* Appears on hover, but always reachable by keyboard: `focus-visible`
          brings it back for anyone tabbing through the rail. */}
      <button
        type="button"
        aria-label={t("discover.dismiss")}
        title={t("discover.dismiss")}
        onClick={onDismiss}
        className={cx(
          "absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full",
          "bg-ink-950/70 text-paper opacity-0 transition-opacity",
          "group-hover/pick:opacity-100 focus-visible:opacity-100",
          "pointer-coarse:opacity-100",
        )}
      >
        <Icon path={ICONS.close} size={14} strokeWidth={2.25} />
      </button>
    </div>
  );
}
