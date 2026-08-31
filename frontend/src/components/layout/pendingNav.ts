import { useTranslation } from "react-i18next";

import { useFriends } from "../../features/social/useSocial";
import { usePendingRecommendationCount } from "../../features/recommend/useRecommend";
import { pendingNavLabel, type Pending } from "./pendingLabel";

/**
 * The one place that decides what "waiting on you" means.
 *
 * Both navigations had their own copy of this sum. They agreed, which is luck
 * rather than design — the desktop bar and the phone bar have to show the same
 * number or one of them is lying about the same screen.
 */
export function usePendingNav(base: string): { pending: Pending; label: string } {
  const { t } = useTranslation();
  const { data: friends } = useFriends();
  const recommendations = usePendingRecommendationCount();
  const requests = friends?.incoming.length ?? 0;

  const pending = { requests, recommendations, total: requests + recommendations };
  return { pending, label: pendingNavLabel(t, base, pending) };
}
