import { z } from "zod";

/**
 * Field names and ranges mirror the backend's `EntryUpdate` Pydantic model
 * one-for-one, so the two validators cannot drift silently: score 0–10, progress
 * non-negative, dates ISO or empty.
 */
export const entryFormSchema = z
  .object({
    status: z.enum(["current", "completed", "on_hold", "dropped", "planned"]),
    score: z.coerce.number().int().min(0).max(10),
    progress: z.coerce.number().int().min(0),
    rewatch_count: z.coerce.number().int().min(0),
    start_date: z.string(),
    finish_date: z.string(),
    notes: z.string().max(10_000),
  })
  .refine(
    (v) => !v.start_date || !v.finish_date || v.start_date <= v.finish_date,
    // Stated as what happened and what to do, no exclamation mark (§8).
    { path: ["finish_date"], message: "Finish date is before the start date — check the dates." },
  );

export type EntryFormValues = z.infer<typeof entryFormSchema>;

/** Empty strings and a 0 score are "unset" on the wire, not literal values. */
export function toApiPayload(values: EntryFormValues) {
  return {
    status: values.status,
    score: values.score === 0 ? null : values.score,
    progress: values.progress,
    rewatch_count: values.rewatch_count,
    start_date: values.start_date || null,
    finish_date: values.finish_date || null,
    notes: values.notes || null,
  };
}
