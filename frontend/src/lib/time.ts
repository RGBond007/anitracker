type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** "2h ago", "yesterday", "3 days ago" — the caption line on the activity rail. */
export function relativeTime(iso: string, t: Translate): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return t("time.minutes", { count: minutes });

  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("time.hours", { count: hours });

  const days = Math.round(hours / 24);
  if (days === 1) return t("time.yesterday");
  if (days < 30) return t("time.days", { count: days });

  const months = Math.round(days / 30);
  return t("time.months", { count: months });
}
