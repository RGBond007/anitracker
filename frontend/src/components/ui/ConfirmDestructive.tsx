import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "./Button";
import { Field } from "./Field";
import { Input } from "./Input";
import { Modal } from "./Modal";

/**
 * The one dialog every destructive action goes through.
 *
 * It replaces `window.confirm`, which could not be made to do this job: the
 * browser's dialog cannot say *which* title is about to go, cannot list what goes
 * with it, cannot be styled to match anything around it, and puts "OK" — a word
 * that describes nothing — under the pointer. The thing being deleted is usually
 * something the person spent months on, and the sentence "Remove this title from
 * your list?" is not enough to decide by.
 *
 * So the contract here is that the caller must name the object in `title` and be
 * specific in `consequences` about what the delete actually takes with it. Those
 * strings are claims about the database, and the cascades behind the ones this
 * app ships are pinned by `test_deleting_an_entry_takes_it_off_every_shelf` and
 * `test_deleting_a_title_takes_its_journal_with_it` — if a migration ever changes
 * what a delete reaches, those fail before this copy quietly becomes a lie.
 */
export function ConfirmDestructive({
  title,
  body,
  consequences,
  confirmLabel,
  pendingLabel,
  requireTyped,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  /** Names the exact object: "Remove Frieren from your library?" */
  title: string;
  /** One sentence on what happens, including what is *not* touched. */
  body: string;
  /** What is deleted along with it. Omitted where the body already covers it. */
  consequences?: string[];
  confirmLabel: string;
  /**
   * Shown on the button while the request is in flight — never a spinner alone.
   * Optional only because not every confirmation is asynchronous: discarding an
   * unsaved form happens between two frames and has nothing to wait for.
   */
  pendingLabel?: string;
  /**
   * Demand this string back, letter for letter, before the action can be taken.
   * Reserved for a delete that destroys somebody else's data and cannot be
   * undone; making a routine removal cost a typing exercise only teaches people
   * to type without reading.
   */
  requireTyped?: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState("");

  /**
   * Latched the instant the button is pressed, rather than waiting for the
   * caller's mutation to report itself pending: between those two moments there
   * is at least one render in which nothing is disabled.
   *
   * The ref is what actually holds the door, and the state only redraws the
   * button. Two clicks landing in the same tick both run before React has
   * re-rendered, so they would both read `fired === false` from the render they
   * were created in and both send the delete — the ref is the only copy that is
   * already true by the time the second one asks.
   */
  const firedRef = useRef(false);
  const [fired, setFired] = useState(false);
  const busy = pending || fired;

  // A failed attempt has to be repeatable: the request is over, the dialog is
  // still up, and the button would otherwise stay dead until it was reopened.
  useEffect(() => {
    if (error) {
      firedRef.current = false;
      setFired(false);
    }
  }, [error]);

  const typedMatches = !requireTyped || typed.trim() === requireTyped;
  const blocked = busy || !typedMatches;

  // Not named `confirm`: that shadows `window.confirm`, which is the exact call
  // this component exists to retire.
  const proceed = () => {
    if (blocked || firedRef.current) return;
    firedRef.current = true;
    setFired(true);
    onConfirm();
  };

  // Closing mid-flight would leave the request running behind a dialog that
  // claimed it had been cancelled. Everything stays put until it answers.
  const dismiss = () => {
    if (!busy) onCancel();
  };

  return (
    <Modal title={title} onClose={dismiss} initialFocusRef={cancelRef}>
      <p className="text-sm leading-relaxed text-text-dim">{body}</p>

      {consequences && consequences.length > 0 && (
        <div className="mt-4 rounded-control border border-line px-4 py-3.5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-stamp-text">
            {t("confirm.affected")}
          </p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {consequences.map((line) => (
              <li key={line} className="flex gap-2.5 text-[13px] leading-relaxed text-text-dim">
                {/* A drawn rule rather than a bullet character, whose size and
                    baseline come from whatever font the OS falls back to. */}
                <span aria-hidden className="mt-[9px] h-px w-2.5 shrink-0 bg-control-line" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requireTyped && (
        <div className="mt-5">
          <Field label={t("confirm.typedLabel", { value: requireTyped })}>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  proceed();
                }
              }}
            />
          </Field>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-stamp-text">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {/* Focused on open, and first in the tab order: the way out is what a
            pressed Return finds, not the deletion. */}
        <Button ref={cancelRef} variant="ghost" disabled={busy} onClick={dismiss}>
          {t("common.cancel")}
        </Button>
        <Button variant="stamp" disabled={blocked} onClick={proceed}>
          {busy ? (pendingLabel ?? confirmLabel) : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
