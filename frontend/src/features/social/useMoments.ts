import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Reaction } from "../../lib/api-client";
import { api } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";

export function useFriendsOnTitle(provider: string | undefined, providerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.friendsOnTitle(provider ?? "", providerId ?? ""),
    queryFn: () => api.friendsOnTitle(provider as string, providerId as string),
    enabled: Boolean(provider && providerId),
  });
}

export function useReactions(entryId: number | null) {
  return useQuery({
    queryKey: queryKeys.reactions(entryId ?? 0),
    queryFn: () => api.reactions(entryId as number),
    enabled: entryId !== null,
  });
}

/**
 * Leaving, changing and taking back a reaction are one mutation, because the
 * control is one toggle: tapping the reaction you already picked clears it, and
 * tapping a different one replaces it. The server enforces the same rule.
 */
export function useReact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, kind }: { entryId: number; kind: Reaction | null }) =>
      kind === null ? api.unreact(entryId) : api.react(entryId, kind),
    onSuccess: (summary) => {
      queryClient.setQueryData(queryKeys.reactions(summary.entry_id), summary);
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed });
    },
  });
}

export function useSharedShelves(username: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sharedShelves(username ?? ""),
    queryFn: () => api.sharedShelves(username as string),
    enabled: Boolean(username),
  });
}
