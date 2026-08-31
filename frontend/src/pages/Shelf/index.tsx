import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useShelf, useDeleteShelf, useReorderShelf, useUpdateShelf } from "../../features/shelves/useShelves";
import { useUiStore } from "../../stores/uiStore";
import { PosterGrid, SectionHead } from "../../components/layout/Rail";
import { Poster } from "../../components/media/Poster";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Field } from "../../components/ui/Field";
import { Icon, ICONS } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { ConfirmDestructive } from "../../components/ui/ConfirmDestructive";
import { Modal } from "../../components/ui/Modal";
import { PosterGridSkeleton } from "../../components/ui/Skeleton";
import { cx } from "../../lib/cx";
import { useErrorMessage } from "../../lib/useErrorMessage";

/**
 * One shelf, in the order its owner arranged.
 *
 * Franchise grouping is deliberately *not* applied here. The library groups seasons
 * into one card so a five-season show does not bury everything else, but a shelf is
 * a running order someone made by hand: if they put season 2 on it and not season 1,
 * showing a merged card would be showing something they did not choose.
 */
export function ShelfPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const shelfId = Number(id);
  const lang = useUiStore((s) => s.titleLanguage);

  const { data: shelf, isLoading } = useShelf(Number.isFinite(shelfId) ? shelfId : null);
  const update = useUpdateShelf();
  const remove = useDeleteShelf();
  const reorder = useReorderShelf();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shared, setShared] = useState(false);

  if (isLoading) {
    return (
      <div className="wrap py-8">
        <PosterGridSkeleton count={6} />
      </div>
    );
  }
  if (!shelf) {
    return (
      <div className="wrap py-10">
        <EmptyState>{t("shelf.missing")}</EmptyState>
      </div>
    );
  }

  const items = shelf.items ?? [];
  const order = items.map((item) => item.entry.id);

  /** Reorder sends the whole run, so a move is expressed as the list it produces. */
  const move = (index: number, by: number) => {
    const next = [...order];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({ id: shelf.id, entryIds: next });
  };

  const openEdit = () => {
    setName(shelf.name);
    setDescription(shelf.description ?? "");
    setShared(shelf.is_shared);
    setEditing(true);
  };

  return (
    <div className="wrap py-8">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <SectionHead>{shelf.name}</SectionHead>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openEdit}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-control px-2.5 py-2 text-[12.5px]",
              "text-text-dim transition-colors hover:text-text",
            )}
          >
            <Icon path={ICONS.pencil} size={14} />
            {t("shelf.edit")}
          </button>
        </div>
      </div>

      {shelf.description && (
        <p className="mb-4 max-w-[60ch] text-[13.5px] leading-relaxed text-text-dim">
          {shelf.description}
        </p>
      )}

      <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
        {t("shelf.count", { count: shelf.item_count })}
      </p>

      {items.length === 0 ? (
        <EmptyState>{t("shelf.empty")}</EmptyState>
      ) : (
        <PosterGrid>
          {items.map((item, index) => (
            <div key={item.entry.id} className="group/item relative">
              <Poster media={item.entry.media} entry={item.entry} lang={lang} />
              {/* Buttons rather than a drag handle: this is the whole reorder
                  affordance, and one that works from a keyboard and on a phone
                  beats one that needs a pointer and a library to implement. */}
              <div className="mt-1.5 flex items-center gap-1">
                <ReorderButton
                  label={t("shelf.moveEarlier")}
                  icon={ICONS.chevronDown}
                  rotate
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, -1)}
                />
                <ReorderButton
                  label={t("shelf.moveLater")}
                  icon={ICONS.chevronDown}
                  disabled={index === items.length - 1 || reorder.isPending}
                  onClick={() => move(index, 1)}
                />
                <span className="tabular ml-auto text-[10px] text-text-faint">{index + 1}</span>
              </div>
            </div>
          ))}
        </PosterGrid>
      )}

      {editing && (
        <Modal title={t("shelf.edit")} onClose={() => setEditing(false)}>
          <div className="space-y-3">
            <Field label={t("shelf.name")}>
              <Input value={name} maxLength={64} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("shelf.description")} hint={t("shelf.descriptionHint")}>
              <Input
                value={description}
                maxLength={280}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            {/* Sharing is a checkbox and nothing else: no audience picker, no link,
                no per-person permissions. It shows the shelf on your profile to the
                people already allowed to see your list, and that is the whole of it. */}
            <label className="flex cursor-pointer items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
                className="mt-[3px] h-[15px] w-[15px] shrink-0 accent-[var(--stamp)]"
              />
              <span className="min-w-0">
                <span className="block text-[13.5px]">{t("shelf.share")}</span>
                <span className="block text-[12px] text-text-faint">{t("shelf.shareHint")}</span>
              </span>
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="quiet"
              onClick={() => {
                setEditing(false);
                setConfirmDelete(true);
              }}
            >
              {t("shelf.delete")}
            </Button>
            <div className="flex gap-2">
              <Button variant="quiet" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="stamp"
                disabled={!name.trim() || update.isPending}
                onClick={() =>
                  update.mutate(
                    {
                      id: shelf.id,
                      patch: {
                        name: name.trim(),
                        description: description.trim() || null,
                        is_shared: shared,
                      },
                    },
                    { onSuccess: () => setEditing(false) },
                  )
                }
              >
                {t("shelf.save")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDestructive
          title={t("shelf.deleteTitle", { name: shelf.name })}
          /* Says what is and is not lost: people hesitate here because they cannot
             tell whether deleting a shelf deletes what is on it. */
          body={t("shelf.deleteBody")}
          consequences={[
            t("shelf.deleteAffectedOrder"),
            // Only claimed where it is true — an unshared shelf has nobody to lose.
            ...(shelf.is_shared ? [t("shelf.deleteAffectedShared")] : []),
          ]}
          confirmLabel={t("shelf.delete")}
          pendingLabel={t("confirm.deleting")}
          pending={remove.isPending}
          error={errorMessage(remove.error)}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate(shelf.id, { onSuccess: () => navigate("/list/current") })}
        />
      )}
    </div>
  );
}

function ReorderButton({
  label,
  icon,
  rotate,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  rotate?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex h-7 w-7 items-center justify-center rounded-control text-text-faint",
        "transition-colors hover:bg-surface hover:text-text disabled:opacity-30",
        "disabled:hover:bg-transparent disabled:hover:text-text-faint",
      )}
    >
      <Icon path={icon} size={14} className={rotate ? "rotate-180" : undefined} />
    </button>
  );
}
