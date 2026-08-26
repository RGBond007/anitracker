import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { Entry, JournalEntry, Mood } from "../../lib/api-client";
import {
  useDeleteJournal,
  useJournalFor,
  useWriteJournal,
} from "../../features/journal/useJournal";
import { calendarDate } from "../../lib/time";
import { Button } from "../ui/Button";
import { ConfirmDestructive } from "../ui/ConfirmDestructive";
import { Field } from "../ui/Field";
import { Icon, ICONS } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { NumberInput, Textarea } from "../ui/Input";
import { Spoiler } from "../ui/Spoiler";
import { cx } from "../../lib/cx";

const MOODS: Mood[] = ["loved", "moved", "tense", "funny", "lost", "dull"];
const MAX_NOTE = 1000;

/**
 * What you thought, episode by episode.
 *
 * Distinct from the general note in the viewing log: that one is a scratchpad for
 * the whole title, this is a series of dated moments. Private, with nothing on
 * this page or behind it that shares one.
 *
 * Absent until something is written, so a title nobody journals stays exactly as
 * it was.
 */
export function Journal({ entry, isManga }: { entry: Entry; isManga: boolean }) {
  const { t } = useTranslation();
  const { data } = useJournalFor(entry.id);
  const [writing, setWriting] = useState<number | null>(null);

  const rows = data ?? [];
  const pass = entry.rewatch_count ?? 0;

  return (
    <section aria-labelledby="journal-heading" className="mb-8 sm:mb-14">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="journal-heading" className="font-display text-[15px] font-bold tracking-[-0.01em]">
          {t("journal.heading")}
        </h2>
        <span className="flex shrink-0 items-center gap-3">
          {/* The way to the timeline from a phone, where the nav has no room. */}
          <Link
            to="/journal"
            className="text-[12.5px] text-text-faint transition-colors hover:text-stamp-text"
          >
            {t("journal.seeAll")}
          </Link>
          <button
            type="button"
            onClick={() => setWriting(Math.max(1, entry.progress || 1))}
            className="text-[12.5px] text-text-faint transition-colors hover:text-stamp-text"
          >
            {t("journal.add")}
          </button>
        </span>
      </div>

      <div className="mt-3 border-t border-line" />

      {rows.length === 0 ? (
        <p className="py-3 text-[13px] text-text-dim">
          {t(isManga ? "journal.emptyManga" : "journal.empty")}
        </p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((row) => (
            <Row key={row.id} row={row} isManga={isManga} onEdit={() => setWriting(row.unit)} />
          ))}
        </ol>
      )}

      {writing !== null && (
        <WriteSheet
          entry={entry}
          isManga={isManga}
          unit={writing}
          pass={pass}
          rows={rows}
          onClose={() => setWriting(null)}
        />
      )}
    </section>
  );
}

/** One moment, as the timeline reads it: what, then the words, then the date. */
function Row({
  row,
  isManga,
  onEdit,
}: {
  row: JournalEntry;
  isManga: boolean;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <li className="py-3">
      <div className="flex items-baseline gap-2">
        <p className="flex-1 text-[13px]">
          <span className="font-semibold">
            {t(isManga ? "journal.chapterRead" : "journal.episodeWatched", { n: row.unit })}
          </span>
          {row.rewatch_index > 0 && (
            <span className="ml-1.5 text-[11.5px] text-text-faint">
              {t("journal.pass", { n: row.rewatch_index + 1 })}
            </span>
          )}
          {row.is_favorite && (
            <span className="ml-1.5 text-stamp-text" title={t("journal.favorite")}>
              ★
            </span>
          )}
          {row.mood && (
            <span className="ml-1.5 text-[11.5px] text-text-dim">
              {t(`journal.mood.${row.mood}`)}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t("journal.edit")}
          className="shrink-0 text-text-faint transition-colors hover:text-text"
        >
          <Icon path={ICONS.pencil} size={13} />
        </button>
      </div>

      {row.note &&
        (row.has_spoilers ? (
          // Covered on your own timeline too: a journal is often reread years
          // later, beside titles you have since forgotten the shape of.
          <Spoiler className="mt-1" reason={t("journal.markedSpoiler")}>
            <span className="block whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-dim">
              “{row.note}”
            </span>
          </Spoiler>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-dim">
            “{row.note}”
          </p>
        ))}

      <p className="mt-1 text-[11.5px] text-text-faint">
        {calendarDate(row.created_at.slice(0, 10), i18n.language)}
      </p>
    </li>
  );
}

function WriteSheet({
  entry,
  isManga,
  unit,
  pass,
  rows,
  onClose,
}: {
  entry: Entry;
  isManga: boolean;
  unit: number;
  pass: number;
  rows: JournalEntry[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const write = useWriteJournal();
  const remove = useDeleteJournal();

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [n, setN] = useState(String(unit));
  const existing =
    rows.find((r) => r.unit === Number(n) && r.rewatch_index === pass) ?? null;

  /**
   * The fields follow the episode number.
   *
   * Opening "add a note" lands on wherever you are, which often *does* already
   * have a note — so the sheet has to be able to switch between editing that one
   * and starting a fresh one as the number changes. Without this, typing a new
   * episode kept the previous one's mood and favourite and silently attached them
   * to a different episode.
   */
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [spoilers, setSpoilers] = useState(false);

  const current = Number(n);
  if (Number.isFinite(current) && current !== loadedFor) {
    setLoadedFor(current);
    setNote(existing?.note ?? "");
    setMood(existing?.mood ?? null);
    setFavorite(existing?.is_favorite ?? false);
    setSpoilers(existing?.has_spoilers ?? false);
  }

  /**
   * Rendered *instead of* the sheet rather than on top of it. Both are `Modal`s,
   * and `Modal` listens for Escape on the window — stacked, one keypress would
   * dismiss the confirmation and the note behind it together. Swapping keeps a
   * single dialog on screen; the sheet's own state stays mounted, so cancelling
   * comes back to a form with everything still typed into it.
   */
  if (confirmingDelete && existing) {
    return (
      <ConfirmDestructive
        title={t(isManga ? "journal.deleteTitleChapter" : "journal.deleteTitle", {
          n: existing.unit,
        })}
        body={t("journal.deleteBody")}
        confirmLabel={t("journal.delete")}
        pendingLabel={t("confirm.deleting")}
        pending={remove.isPending}
        error={remove.error ? String(remove.error) : undefined}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => remove.mutate(existing.id, { onSuccess: onClose })}
      />
    );
  }

  return (
    <Modal title={t("journal.writeTitle")} onClose={onClose}>
      <div className="space-y-3">
        <Field label={t(isManga ? "journal.chapter" : "journal.episode")}>
          <NumberInput min={1} value={n} onChange={(e) => setN(e.target.value)} />
        </Field>

        <Field label={t("journal.note")} hint={t("journal.noteHint")}>
          <Textarea
            rows={3}
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("journal.placeholder")}
          />
        </Field>

        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">
            {t("journal.mood.label")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mood === m}
                // Tapping the chosen mood clears it: a mood is optional, and
                // there has to be a way back to having said nothing.
                onClick={() => setMood(mood === m ? null : m)}
                className={cx(
                  "rounded-pill border px-3 py-1 text-[12.5px] transition-colors",
                  mood === m
                    ? "border-stamp bg-stamp/15 text-text"
                    : "border-line text-text-dim hover:border-control-line",
                )}
              >
                {t(`journal.mood.${m}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
            className="h-[15px] w-[15px] shrink-0 accent-[var(--stamp)]"
          />
          <span className="text-[13px]">{t("journal.markFavorite")}</span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={spoilers}
            onChange={(e) => setSpoilers(e.target.checked)}
            className="mt-[3px] h-[15px] w-[15px] shrink-0 accent-[var(--stamp)]"
          />
          <span className="min-w-0">
            <span className="block text-[13px]">{t("journal.markSpoiler")}</span>
            <span className="block text-[11.5px] text-text-faint">{t("journal.markSpoilerHint")}</span>
          </span>
        </label>

        {pass > 0 && <p className="text-[11.5px] text-text-faint">{t("journal.writingPass", { n: pass + 1 })}</p>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        {existing ? (
          <Button variant="quiet" onClick={() => setConfirmingDelete(true)}>
            {t("journal.delete")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="quiet" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="stamp"
            disabled={!n.trim() || write.isPending}
            onClick={() =>
              write.mutate(
                {
                  entryId: entry.id,
                  unit: Number(n),
                  note: note.trim() || null,
                  mood,
                  is_favorite: favorite,
                  has_spoilers: spoilers,
                },
                { onSuccess: onClose },
              )
            }
          >
            {t("journal.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
