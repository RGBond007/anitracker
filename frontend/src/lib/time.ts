type Translate = (key: string, opts?: Record<string, unknown>) => string;

/**
 * A stored `YYYY-MM-DD` in the reader's own date format — 17.08.2026 in German,
 * 8/17/2026 in American English.
 *
 * The parts are pulled apart by hand because `new Date("2026-08-17")` is defined
 * to be UTC midnight, which in any negative offset renders as the day before.
 */
export function calendarDate(iso: string, locale: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(locale);
}

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
