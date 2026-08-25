import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { FriendOnTitle } from "../../lib/api-client";
import { useFriendsOnTitle } from "../../features/social/useMoments";
import { useStatusLabel } from "./statusLabels";
import { Avatar } from "../ui/Avatar";
import { cx } from "../../lib/cx";

/**
 * Who else you know has this, where they are with it, and what they gave it.
 *
 * One section rather than two, because "which friends are watching this" and "how
 * do our scores compare" are the same glance: a row per friend carrying a status,
 * a progress figure and a score answers both without a chart.
 *
 * Absent when nobody you know tracks it. "None of your friends has seen this" is
 * true but not worth a panel, and §8 asks for the section to be gone instead.
 */
export function FriendsOnTitle({
  provider,
  providerId,
  isManga,
}: {
  provider: string;
  providerId: string;
  isManga: boolean;
}) {
  const { t } = useTranslation();
  const statusLabel = useStatusLabel();
  const { data } = useFriendsOnTitle(provider, providerId);

  const friends = data?.friends ?? [];
  if (friends.length === 0) return null;

  const mine = data?.my_score ?? null;

  return (
    <section aria-labelledby="friends-on-title" className="mb-8 sm:mb-14">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="friends-on-title"
          className="font-display text-[15px] font-bold tracking-[-0.01em]"
        >
          {t("moments.friendsHeading")}
        </h2>
        {mine !== null && (
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-dim">
            {t("moments.yourScore", { score: mine })}
          </p>
        )}
      </div>

      <div className="mt-3 border-t border-line" />

      <ul className="divide-y divide-line">
        {friends.map((friend) => (
          <li key={friend.user.id}>
            <Row friend={friend} mine={mine} label={statusLabel} isManga={isManga} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({
  friend,
  mine,
  label,
  isManga,
  t,
}: {
  friend: FriendOnTitle;
  mine: number | null;
  label: (status: FriendOnTitle["status"], type: "anime" | "manga") => string;
  isManga: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const type = isManga ? "manga" : "anime";
  // The comparison, stated only when both people actually scored it. A difference
  // against a null score would be arithmetic on an absence.
  const gap = mine !== null && friend.score !== null ? friend.score - mine : null;

  return (
    <Link
      to={`/u/${friend.user.username}`}
      className="flex items-center gap-3 py-2.5 transition-colors hover:text-text"
    >
      <Avatar user={friend.user} size={26} decorative />
      <span className="min-w-0 flex-1 truncate text-[13.5px]">{friend.user.username}</span>

      <span className="shrink-0 text-[12px] text-text-dim">{label(friend.status, type)}</span>

      <span className="tabular w-[52px] shrink-0 text-right text-[13px]">
        {friend.score ?? "—"}
      </span>

      {/* Only drawn when there is a real difference to draw: an equal score gets a
          dash rather than "+0", which reads as a value rather than as agreement. */}
      <span
        className={cx(
          "tabular w-[42px] shrink-0 text-right text-[11.5px]",
          gap === null || gap === 0 ? "text-text-faint" : "text-stamp-text",
        )}
        title={gap !== null ? t("moments.vsYou") : undefined}
      >
        {gap === null ? "" : gap === 0 ? t("moments.same") : gap > 0 ? `+${gap}` : `${gap}`}
      </span>
    </Link>
  );
}
