import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { FriendRecommendation, TitleLanguage } from "../../lib/api-client";
import {
  useRecommendInbox,
  useSetRecommendationState,
} from "../../features/recommend/useRecommend";
import { useAddEntry } from "../../features/media/useMedia";
import { useShelves, useShelveEntry } from "../../features/shelves/useShelves";
import { mediaHref } from "../../components/media/Poster";
import { CoverImage } from "../../components/media/CoverImage";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { SectionHead } from "../../components/layout/Rail";
import { Spoiler } from "../../components/ui/Spoiler";
import { relativeTime } from "../../lib/time";
import { cx } from "../../lib/cx";

/**
 * Titles friends handed you directly.
 *
 * Distinct from the rows below it, and deliberately above them: everything else on
 * this page is inferred from what friends happen to have scored, while these were
 * chosen for you by a person who said so. That difference is the whole feature, so
 * the card leads with who sent it.
 */
export function RecommendationInbox({ lang }: { lang: TitleLanguage }) {
  const { t } = useTranslation();
  const { data } = useRecommendInbox();
  const [placing, setPlacing] = useState<{ entryId: number; title: string } | null>(null);

  const rows = data ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionHead>{t("recommend.inbox")}</SectionHead>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <InboxCard row={row} lang={lang} onAdded={setPlacing} />
          </li>
        ))}
      </ul>

      {placing && (
        <ShelfPrompt
          entryId={placing.entryId}
          title={placing.title}
          onClose={() => setPlacing(null)}
        />
      )}
    </section>
  );
}

function InboxCard({
  row,
  lang,
  onAdded,
}: {
  row: FriendRecommendation;
  lang: TitleLanguage;
  onAdded: (target: { entryId: number; title: string }) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setState = useSetRecommendationState();
  const add = useAddEntry();
  const [confirming, setConfirming] = useState(false);

  const title =
    row.media?.title_english || row.media?.title_romaji || t("recommend.unknownTitle");

  /** Opening it is the "viewed" edge; the state is a by-product of reading, not a button. */
  const open = () => {
    if (row.state === "pending") setState.mutate({ id: row.id, state: "viewed" });
    if (row.media) navigate(mediaHref(row.media));
  };

  /**
   * Accepting adds the title as *planned* and nothing more. The brief is explicit
   * that accepting must not begin it, so there is no progress written and no status
   * that implies one -- and the confirmation step says so in as many words, because
   * "add" is the one button here that writes to the reader's own library.
   */
  const accept = () =>
    add.mutate(
      {
        provider: row.provider,
        provider_id: row.provider_id,
        type: row.media_type,
        status: "planned",
      },
      {
        onSuccess: (entry) => {
          setState.mutate({ id: row.id, state: "accepted" });
          setConfirming(false);
          onAdded({ entryId: entry.id, title });
        },
      },
    );

  return (
    <div className="flex items-start gap-3 rounded-control border border-line bg-surface p-3">
      {row.media && (
        <button
          type="button"
          onClick={open}
          aria-label={title}
          className="w-[44px] shrink-0 overflow-hidden rounded-[5px]"
          style={{ boxShadow: "var(--rim)" }}
        >
          <CoverImage media={row.media} lang={lang} className="aspect-2/3 w-full" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        {/* Who and when, before the title: the answer to "why is this here". */}
        <p className="flex items-center gap-1.5 text-[12px] text-text-dim">
          <Avatar user={row.sender} size={18} decorative />
          {t("recommend.from", { name: row.sender.username })}
          <span aria-hidden className="text-text-faint">
            ·
          </span>
          <span className="text-text-faint">{relativeTime(row.created_at, t)}</span>
        </p>

        <button
          type="button"
          onClick={open}
          className="mt-1 block max-w-full truncate text-left font-display text-[14px] font-semibold hover:text-stamp-text"
        >
          {title}
        </button>

        {/* Rendered as text, never as markup: React escapes it, and the server caps
            it at 280 characters so a card cannot be turned into a wall.

            Covered when the sender said it gives something away, *or* when they
            are further into the title than you are — the second is what catches
            the common case of somebody forgetting to tick the box. */}
        {row.message &&
          (row.has_spoilers || row.sender_ahead ? (
            <Spoiler
              className="mt-1"
              reason={
                row.has_spoilers
                  ? t("recommend.spoilerDeclared")
                  : t("recommend.spoilerAhead", { name: row.sender.username })
              }
            >
              <span className="block whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-dim">
                {row.message}
              </span>
            </Spoiler>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-dim">
              {row.message}
            </p>
          ))}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button
            variant="stamp"
            className="px-3 py-1.5 text-[12.5px]"
            disabled={row.state === "accepted"}
            pending={add.isPending}
            pendingLabel={t("common.adding")}
            onClick={() => setConfirming(true)}
          >
            {row.state === "accepted" ? t("recommend.added") : t("recommend.addToList")}
          </Button>
          <Button variant="ghost" className="px-3 py-1.5 text-[12.5px]" onClick={open}>
            {t("recommend.view")}
          </Button>
          <button
            type="button"
            onClick={() => setState.mutate({ id: row.id, state: "dismissed" })}
            className={cx(
              "rounded-control px-2.5 py-1.5 text-[12.5px] text-text-faint",
              "transition-colors hover:text-text",
            )}
          >
            {t("recommend.dismiss")}
          </button>
        </div>
      </div>

      {confirming && (
        <Modal title={t("recommend.confirmTitle", { name: title })} onClose={() => setConfirming(false)}>
          {/* States the guarantee rather than implying it: the single most common
              worry about an "add" button on someone else's suggestion is that it
              will claim you started something. */}
          <p className="text-sm text-text-dim">{t("recommend.confirmBody")}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="stamp"
              pending={add.isPending}
              pendingLabel={t("common.adding")}
              onClick={accept}
            >
              {t("recommend.confirmAdd")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * The step the brief asks for after accepting: put it on one of your own shelves.
 *
 * Offered, never automatic, and skippable — the title is already in the library by
 * the time this appears, so closing it loses nothing.
 */
function ShelfPrompt({
  entryId,
  title,
  onClose,
}: {
  entryId: number;
  title: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const shelves = useShelves();
  const shelve = useShelveEntry();
  const list = shelves.data ?? [];

  return (
    <Modal title={t("recommend.shelveTitle", { name: title })} onClose={onClose}>
      {list.length === 0 ? (
        <p className="text-sm text-text-dim">{t("recommend.noShelves")}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-text-dim">{t("recommend.shelveBody")}</p>
          <div className="flex flex-wrap gap-1.5">
            {list.map((shelf) => (
              <button
                key={shelf.id}
                type="button"
                disabled={shelve.isPending}
                aria-busy={shelve.isPending || undefined}
                onClick={() =>
                  shelve.mutate({ id: shelf.id, entryId, on: true }, { onSuccess: onClose })
                }
                className={cx(
                  "rounded-pill border border-line px-3 py-1.5 text-[12.5px] text-text-dim",
                  "transition-colors hover:border-control-line hover:text-text",
                )}
              >
                {shelf.name}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="quiet" onClick={onClose}>
          {t("recommend.skipShelf")}
        </Button>
      </div>
    </Modal>
  );
}
