import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";

import type { Entry, EntryStatus, MediaType } from "../../lib/api-client";
import { entryFormSchema, toApiPayload, type EntryFormValues } from "../../features/media/entrySchema";
import { useDeleteEntry, useUpdateEntry } from "../../features/media/useMedia";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { NumberInput, Input, Select, Textarea } from "../ui/Input";
import { useStatusLabel } from "./statusLabels";

const STATUSES: EntryStatus[] = ["current", "completed", "on_hold", "dropped", "planned"];

export function EntryForm({
  entry,
  type,
  onDone,
}: {
  entry: Entry;
  type: MediaType;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const statusLabel = useStatusLabel();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: {
      status: entry.status,
      score: entry.score ?? 0,
      progress: entry.progress,
      rewatch_count: entry.rewatch_count,
      start_date: entry.start_date ?? "",
      finish_date: entry.finish_date ?? "",
      notes: entry.notes ?? "",
    },
  });

  const submit = handleSubmit((values) => {
    update.mutate(
      { id: entry.id, patch: toApiPayload(values) },
      { onSuccess: () => onDone?.() },
    );
  });

  const total = entry.media.total_units;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("entry.status")} htmlFor="entry-status">
          <Select id="entry-status" {...register("status")}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, type)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("entry.score")} hint={t("entry.scoreHint")} error={errors.score?.message}>
          <Select {...register("score")}>
            <option value={0}>{t("entry.unscored")}</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={total ? `${t("entry.progress")} / ${total}` : t("entry.progress")}
          error={errors.progress?.message}
        >
          <NumberInput min={0} max={total ?? undefined} {...register("progress")} />
        </Field>

        <Field label={t("entry.rewatches")} error={errors.rewatch_count?.message}>
          <NumberInput min={0} {...register("rewatch_count")} />
        </Field>

        <Field label={t("entry.startDate")} error={errors.start_date?.message}>
          <Input type="date" {...register("start_date")} />
        </Field>

        <Field label={t("entry.finishDate")} error={errors.finish_date?.message}>
          <Input type="date" {...register("finish_date")} />
        </Field>
      </div>

      <Field label={t("entry.notes")} error={errors.notes?.message}>
        <Textarea rows={3} {...register("notes")} />
      </Field>

      {update.error && <p className="text-sm text-stamp-text">{String(update.error)}</p>}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          className="text-sm text-text-dim underline-offset-2 hover:text-stamp hover:underline"
          onClick={() => {
            if (confirm(t("entry.removeConfirm"))) {
              remove.mutate(entry.id, { onSuccess: () => onDone?.() });
            }
          }}
        >
          {t("entry.remove")}
        </button>

        <div className="flex gap-2">
          {onDone && (
            <Button type="button" variant="quiet" onClick={onDone}>
              {t("common.cancel")}
            </Button>
          )}
          {/* The button names the action; the toast repeats the verb (§8). */}
          <Button type="submit" variant="stamp" disabled={update.isPending || !isDirty}>
            {t("entry.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
