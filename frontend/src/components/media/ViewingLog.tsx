import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Entry, EntryStatus, Season, Series, TitleLanguage } from "../../lib/api-client";
import {
  useDeleteEntry,
  useIncrementEntry,
  useUpdateEntry,
} from "../../features/media/useMedia";
import { useSetCurrentSeason } from "../../features/media/useSeasons";
import { calendarDate } from "../../lib/time";
import { cx } from "../../lib/cx";
import { Button } from "../ui/Button";
import { Icon, ICONS } from "../ui/Icon";
import { Menu } from "../ui/Menu";
import { Modal } from "../ui/Modal";
import { Sheet } from "../ui/Sheet";
import { EntryForm } from "./EntryForm";
import { declineSeasonPrompt, nextAfter } from "./SeasonActions";
import { useSeasonLabels } from "./seasonLabels";
import { useStatusLabel } from "./statusLabels";

const STATUSES: EntryStatus[] = ["current", "completed", "on_hold", "dropped", "planned"];

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

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<"finish" | "continue" | "remove" | null>(null);

  const type = entry.media.type;
  const isManga = type === "manga";
  const total = entry.media.total_units ?? null;
  const pct = total ? Math.min(100, (entry.progress / total) * 100) : 0;
  const atEnd = total != null && entry.progress >= total;
  // The last one is a decision, not a click: it completes the season server-side.
  const wouldFinish = total != null && entry.progress + 1 >= total;

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

        <div className="flex min-w-0 flex-1 basis-[200px] items-center gap-3">
          <p className="tabular shrink-0 text-[13px]">{progressText}</p>
          {total ? (
            <div
              aria-hidden
              className="h-[3px] w-full min-w-[48px] max-w-[220px] overflow-hidden rounded-pill bg-line"
            >
              <div
                className="h-full rounded-pill bg-stamp transition-[width] ease-out"
                style={{ width: `${pct}%`, transitionDuration: "var(--motion-lift)" }}
              />
            </div>
          ) : null}
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
            items={[
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
