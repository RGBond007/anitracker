import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";

/**
 * Recommendations handed between friends.
 *
 * Every write invalidates the inbox *and* the per-title lookup: the "recommended
 * by" line on a title's page is served by a different key, and leaving it stale
 * after dismissing something means the page still names a friend for a card the
 * reader just cleared.
 */
function useRecommendInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recommendInbox });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recommendSent });
    void queryClient.invalidateQueries({ queryKey: ["recommended-by"] });
  };
}

export function useRecommendInbox() {
  return useQuery({ queryKey: queryKeys.recommendInbox, queryFn: api.recommendInbox });
}

export function useRecommendedBy(provider: string | undefined, providerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.recommendedBy(provider ?? "", providerId ?? ""),
    queryFn: () => api.recommendedBy(provider as string, providerId as string),
    enabled: Boolean(provider && providerId),
  });
}

export function useSendRecommendation() {
  const invalidate = useRecommendInvalidation();
  return useMutation({ mutationFn: api.recommendSend, onSuccess: invalidate });
}

export function useSetRecommendationState() {
  const invalidate = useRecommendInvalidation();
  return useMutation({
    mutationFn: ({ id, state }: { id: number; state: "viewed" | "accepted" | "dismissed" }) =>
      api.recommendSetState(id, state),
    onSuccess: invalidate,
  });
}

/**
 * How many recommendations are still waiting on the reader.
 *
 * Counts `pending` only, never the whole inbox. Opening one moves it to `viewed`
 * and it stays on the page — a badge that counted every card would never go down,
 * which trains people to ignore it.
 */
export function usePendingRecommendationCount(): number {
  const { data } = useRecommendInbox();
  return (data ?? []).filter((row) => row.state === "pending").length;
}
