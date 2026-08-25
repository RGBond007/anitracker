import { useTranslation } from "react-i18next";

import { useRecommendedBy } from "../../features/recommend/useRecommend";
import { Avatar } from "../ui/Avatar";

/**
 * "Kaito sent you this" — shown on the title's own page.
 *
 * The brief asks that a recommendation clearly identify who made it and why the
 * title appears at all, and the place that question actually gets asked is here,
 * when someone follows a link and finds a show they never chose. Absent when
 * nobody recommended it, which is almost always.
 */
export function RecommendedBy({ provider, providerId }: { provider: string; providerId: string }) {
  const { t } = useTranslation();
  const { data } = useRecommendedBy(provider, providerId);

  const senders = data ?? [];
  if (senders.length === 0) return null;

  const names = senders.map((user) => user.username);

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-line bg-surface px-3 py-2 text-[12.5px] text-text-dim">
      <span className="flex -space-x-1.5">
        {senders.slice(0, 3).map((user) => (
          <Avatar key={user.id} user={user} size={20} decorative />
        ))}
      </span>
      {names.length === 1
        ? t("recommend.fromOne", { name: names[0] })
        : t("recommend.fromMany", { name: names[0], count: names.length - 1 })}
    </p>
  );
}
