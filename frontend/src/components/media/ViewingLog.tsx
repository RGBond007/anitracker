import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Entry, EntryStatus, Season, Series, TitleLanguage } from "../../lib/api-client";
import {
  useDeleteEntry,
  useIncrementEntry,
  useUpdateEntry,
} from "../../features/media/useMedia";
import { useSetCurrentSeason } from "../../features/media/useSeasons";
import {
  useCreateShelf,
  useShelveEntry,
  useShelves,
} from "../../features/shelves/useShelves";
import { calendarDate } from "../../lib/time";
import { cx } from "../../lib/cx";
import { Button } from "../ui/Button";
import { Icon, ICONS } from "../ui/Icon";
import { Menu } from "../ui/Menu";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Sheet } from "../ui/Sheet";
import { EntryForm } from "./EntryForm";
import { RecommendSheet } from "./RecommendSheet";
import { SpoilerWarning } from "./SpoilerWarning";
import { ProgressLedger } from "./ProgressLedger";
import { declineSeasonPrompt, nextAfter } from "./SeasonActions";
import { useSeasonLabels } from "./seasonLabels";
import { useStatusLabel } from "./statusLabels";

const STATUSES: EntryStatus[] = ["current", "completed", "on_hold", "dropped", "planned"];

/** Offered when creating a shelf; never written into an account on its own. */
const SHELF_SUGGESTIONS = ["favorites", "comfort", "withFriends", "soundtracks", "weekend"];

/**
 * What the viewer has done with the season they are looking at, and the two or
 * three things they are likely to do next.
 *
 * It reads as a line of the page rather than a form: one row carrying the status,
 * the count, the bar and "+ Episode", with a caption of dates under it. Everything
 * else an entry holds — the score, the notes, the exact numbers — is a field
 * someone touches once a season, so it lives in a drawer behind "Edit details"
 * instead of standing open under the artwork.
 *
 * The entry it shows is the *viewed* season's, never the current one's: browsing
 * back to season 1 shows season 1's progress and moves nothing.
 */
export function ViewingLog({
  entry,
  seasonLabel,
  title,
  series,
  viewed,
  lang,
  onView,
}: {
  entry: Entry;
  /** "Season 3" on a show with seasons; null on a standalone title. */
  seasonLabel: string | null;
  /** The title, for the places a season label would be too vague to name. */
  title: string;
  series: Series | null;
  viewed: Season | null;
  lang: TitleLanguage;
  onView: (season: Season) => void;
}) {
  const { t, i18n } = useTranslation();
  const statusLabel = useStatusLabel();
  const { name: seasonName } = useSeasonLabels();

  const increment = useIncrementEntry();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const setCurrent = useSetCurrentSeason();

  const shelves = useShelves();
  const shelve = useShelveEntry();
  const createShelf = useCreateShelf();

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<"finish" | "continue" | "remove" | null>(null);
  const [newShelf, setNewShelf] = useState<string | null>(null);
  const [recommending, setRecommending] = useState(false);

  const type = entry.media.type;
  const isManga = type === "manga";
  const total = entry.media.total_units ?? null;
  const atEnd = total != null && entry.progress >= total;
  // The last one is a decision, not a click: it completes the season server-side.
  const wouldFinish = total != null && entry.progress + 1 >= total;

  // Which shelves already hold this entry. `entry_ids` is exactly why the index
  // sends it: one request answers for every shelf, and the menu never has to open
  // a shelf to find out whether to draw a tick.
  const onShelf = new Set(
    (shelves.data ?? [])
      .filter((shelf) => shelf.entry_ids.includes(entry.id))
      .map((shelf) => shelf.id),
  );

  const next = series && viewed ? nextAfter(series, viewed) : null;
  const nextName = next && series ? seasonName(next, series.title, lang) : null;
  const whatFinished = seasonLabel ?? title;

  const unit = isManga ? "chapter" : "episode";
  const progressText = total
    ? t(`log.${unit}Of`, { progress: entry.progress, total })
    : t(`log.${unit}`, { progress: entry.progress });

  const logOne = () => {
    if (wouldFinish) {
      setConfirming("finish");
      return;
    }
    increment.mutate(entry.id);
  };

  const finish = () =>
    increment.mutate(entry.id, {
      onSuccess: () => {
        // The offer to carry on, and only an offer: moving between seasons stays
        // something the viewer asks for.
        setConfirming(next && viewed?.is_current ? "continue" : null);
      },
    });

  const startNext = () => {
    if (!next || !series) return;
    setCurrent.mutate(
      { root: series.root_provider_id, provider_id: next.media.provider_id, start: true },
      {
        onSuccess: () => {
          setConfirming(null);
          onView(next);
        },
      },
    );
  };

  const metadata = [
    entry.start_date
      ? t("log.started", { date: calendarDate(entry.start_date, i18n.language) })
      : t("log.noStartDate"),
    t(isManga ? "log.rereads" : "log.rewatches", { count: entry.rewatch_count }),
    entry.notes ? t("log.hasNotes") : t("log.noNotes"),
  ];

  return (
    <section aria-labelledby="viewing-log-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="viewing-log-heading"
          className="font-display text-[15px] font-bold tracking-[-0.01em]"
        >
          {t("log.heading")}
        </h2>
        {seasonLabel && (
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-dim">
            {seasonLabel}
          </p>
        )}
      </div>

      {/* The one rule in the section: it carries the header, nothing frames it. */}
      <div className="mt-3 border-t border-line" />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
        <Menu
          label={t("log.changeStatus")}
          triggerClassName={cx(
            "inline-flex items-center gap-2 rounded-pill border border-line bg-surface",
            "px-3.5 py-1.5 text-[12.5px] text-text transition-colors hover:border-control-line",
            "pointer-coarse:px-4",
          )}
          items={STATUSES.map((s) => ({
            key: s,
            label: statusLabel(s, type),
            selected: s === entry.status,
            onSelect: () => update.mutate({ id: entry.id, patch: { status: s } }),
          }))}
        >
          <span
            aria-hidden
            className={cx(
              "h-[6px] w-[6px] rounded-full",
              entry.status === "current" ? "bg-stamp" : "bg-text-faint",
            )}
          />
          {statusLabel(entry.status, type)}
          <Icon path={ICONS.chevronDown} size={14} className="text-text-dim" />
        </Menu>

        {/* basis-[260px] rather than 200: on a phone this row wraps, and a ledger
            sharing a line with the status pill is left too narrow to draw notches
            in. At 260 it takes a line of its own and gets the full column. */}
        <div className="flex min-w-0 flex-1 basis-[260px] items-center gap-3">
          <p className="tabular shrink-0 text-[13px]">{progressText}</p>
          <ProgressLedger
            progress={entry.progress}
            total={total}
            isManga={isManga}
            className="w-full min-w-[48px] max-w-[220px]"
            // The page's one announcing ledger: this is the copy beside the button
            // that changes the number, so it is the one worth hearing.
            announce
          />
        </div>

        <p className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">
            {t("entry.score")}
          </span>
          <span className="tabular text-[13px]">{entry.score ?? "—"}</span>
        </p>

        <div className="flex items-center gap-1">
          <Button
            variant="stamp"
            className="gap-1.5 px-3.5 py-2 text-[13px]"
            disabled={atEnd || increment.isPending}
            onClick={logOne}
          >
            <Icon path={ICONS.plus} size={14} strokeWidth={2.25} />
            {t(isManga ? "log.addChapter" : "log.addEpisode")}
          </Button>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-control px-2.5 py-2 text-[12.5px]",
              "text-text-dim transition-colors hover:text-text",
            )}
          >
            <Icon path={ICONS.pencil} size={14} />
            {t("log.editDetails")}
          </button>

          <Menu
            label={t("log.moreActions")}
            triggerLabel={t("log.moreActions")}
            align="end"
            triggerClassName={cx(
              "flex h-9 w-9 items-center justify-center rounded-control text-text-dim",
              "transition-colors hover:bg-surface hover:text-text pointer-coarse:min-w-[44px]",
            )}
            /* Shelving lives in the menu that already exists rather than behind a
               control of its own. It is a toggle with a tick, which is exactly what
               this menu draws, and a title belongs to any number of shelves — so
               the list is as long as the user has made it, with "New shelf" at the
               end for the case where the right one does not exist yet. */
            items={[
              ...(shelves.data ?? []).map((shelf) => ({
                key: `shelf-${shelf.id}`,
                label: shelf.name,
                selected: onShelf.has(shelf.id),
                disabled: shelve.isPending,
                onSelect: () =>
                  shelve.mutate({
                    id: shelf.id,
                    entryId: entry.id,
                    on: !onShelf.has(shelf.id),
                  }),
              })),
              {
                key: "new-shelf",
                label: t("shelf.new"),
                onSelect: () => setNewShelf(""),
              },
              {
                key: "recommend",
                label: t("recommend.action"),
                onSelect: () => setRecommending(true),
              },
              {
                key: "remove",
                label: t("entry.remove"),
                destructive: true,
                onSelect: () => setConfirming("remove"),
              },
            ]}
          >
            <Icon path={ICONS.more} size={18} strokeWidth={2.5} />
          </Menu>
        </div>
      </div>

      {/* Directly under the row holding "+ Episode": a warning about a button is
          worth nothing if it is somewhere the reader is not looking. */}
      <SpoilerWarning
        provider={entry.media.provider}
        providerId={entry.media.provider_id}
        nextUnit={entry.progress + 1}
      />

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-faint">
        {metadata.map((line, index) => (
          <span key={index} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden>·</span>}
            {line}
          </span>
        ))}
      </p>

      {editing && (
        <Sheet title={t("log.details")} onClose={() => setEditing(false)}>
          {/* The old inline form, unchanged and still the only thing that writes
              these fields — moved behind the button that asks for it. */}
          <EntryForm
            key={entry.id}
            entry={entry}
            type={type}
            showRemove={false}
            submitLabel={t("log.saveChanges")}
            onDone={() => setEditing(false)}
          />
        </Sheet>
      )}

      {confirming === "finish" && (
        <Modal title={t("log.finishTitle", { name: whatFinished })} onClose={() => setConfirming(null)}>
          <p className="text-sm text-text-dim">
            {t(isManga ? "log.finishBodyManga" : "log.finishBody", { total })}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setConfirming(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="stamp" disabled={increment.isPending} onClick={finish}>
              {t("log.finishConfirm")}
            </Button>
          </div>
        </Modal>
      )}

      {confirming === "continue" && next && nextName && (
        <Modal
          title={t("season.finishedHeading", { name: whatFinished })}
          onClose={() => setConfirming(null)}
        >
          <p className="text-sm text-text-dim">{t("log.continueBody", { name: nextName })}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="quiet"
              onClick={() => {
                // Turned down here is turned down everywhere: the same offer is
                // made beside the title, and it should not be asked twice.
                if (viewed) declineSeasonPrompt(viewed.media.provider_id);
                setConfirming(null);
              }}
            >
              {t("season.notNow")}
            </Button>
            <Button variant="stamp" disabled={setCurrent.isPending} onClick={startNext}>
              {t("season.startNamed", { name: nextName })}
            </Button>
          </div>
        </Modal>
      )}

      {recommending && (
        <RecommendSheet media={entry.media} onClose={() => setRecommending(false)} />
      )}

      {newShelf !== null && (
        <Modal title={t("shelf.new")} onClose={() => setNewShelf(null)}>
          <Field label={t("shelf.name")} hint={t("shelf.nameHint")}>
            <Input
              autoFocus
              value={newShelf}
              maxLength={64}
              onChange={(e) => setNewShelf(e.target.value)}
            />
          </Field>
          {/* The names from the brief, offered rather than seeded. Nobody starts
              with an empty "Best soundtracks" they never asked for, but nobody has
              to think of the word either. Already-used names are filtered out. */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SHELF_SUGGESTIONS.filter(
              (key) => !(shelves.data ?? []).some((s) => s.name === t(`shelf.suggest.${key}`)),
            ).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setNewShelf(t(`shelf.suggest.${key}`))}
                className={cx(
                  "rounded-pill border border-line px-3 py-1 text-[12px] text-text-dim",
                  "transition-colors hover:border-control-line hover:text-text",
                )}
              >
                {t(`shelf.suggest.${key}`)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setNewShelf(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="stamp"
              disabled={!newShelf.trim() || createShelf.isPending}
              onClick={() =>
                createShelf.mutate(
                  { name: newShelf.trim() },
                  {
                    // Created *and* used in one step: opening this from a title
                    // means the title is the reason the shelf exists.
                    onSuccess: (shelf) => {
                      shelve.mutate({ id: shelf.id, entryId: entry.id, on: true });
                      setNewShelf(null);
                    },
                  },
                )
              }
            >
              {t("shelf.createAndAdd")}
            </Button>
          </div>
        </Modal>
      )}

      {confirming === "remove" && (
        <Modal title={t("entry.remove")} onClose={() => setConfirming(null)}>
          <p className="text-sm text-text-dim">{t("entry.removeConfirm")}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setConfirming(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="stamp"
              disabled={remove.isPending}
              onClick={() => remove.mutate(entry.id, { onSuccess: () => setConfirming(null) })}
            >
              {t("entry.remove")}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
