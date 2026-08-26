import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";

/**
 * Any write to a group changes what every view of it says, so all three keys go:
 * the index, the group itself, and the per-title lookup the title page uses.
 * A stale roster beside a group you just joined is the one error people notice.
 */
function useWatchInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.watchGroups });
    void queryClient.invalidateQueries({ queryKey: ["watch-group"] });
    void queryClient.invalidateQueries({ queryKey: ["watch-group-for"] });
    void queryClient.invalidateQueries({ queryKey: ["watch-spoiler"] });
  };
}

export function useWatchGroups() {
  return useQuery({ queryKey: queryKeys.watchGroups, queryFn: api.watchGroups });
}

export function useWatchGroupForTitle(provider: string | undefined, providerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.watchGroupForTitle(provider ?? "", providerId ?? ""),
    queryFn: () => api.watchGroupForTitle(provider as string, providerId as string),
    enabled: Boolean(provider && providerId),
  });
}

/**
 * Who logging `unit` would leave behind.
 *
 * Only asked when there is a group and a position to ask about, and kept fresh
 * rather than cached hard: the answer changes every time somebody else watches
 * an episode, and a stale "nobody is behind" is exactly the wrong thing to be
 * confident about.
 */
export function useSpoilerCheck(groupId: number | null, unit: number | null) {
  return useQuery({
    queryKey: queryKeys.watchSpoiler(groupId ?? 0, unit ?? 0),
    queryFn: () => api.watchSpoilerCheck(groupId as number, unit as number),
    enabled: groupId !== null && unit !== null,
    staleTime: 0,
  });
}

export function useCreateWatchGroup() {
  const invalidate = useWatchInvalidation();
  return useMutation({ mutationFn: api.createWatchGroup, onSuccess: invalidate });
}

export function useJoinWatchGroup() {
  const invalidate = useWatchInvalidation();
  return useMutation({ mutationFn: api.joinWatchGroup, onSuccess: invalidate });
}

export function useLeaveWatchGroup() {
  const invalidate = useWatchInvalidation();
  return useMutation({ mutationFn: api.leaveWatchGroup, onSuccess: invalidate });
}

export function useCloseWatchGroup() {
  const invalidate = useWatchInvalidation();
  return useMutation({ mutationFn: api.closeWatchGroup, onSuccess: invalidate });
}

export function useInviteToWatchGroup() {
  const invalidate = useWatchInvalidation();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: number; userIds: number[] }) =>
      api.inviteToWatchGroup(id, userIds),
    onSuccess: invalidate,
  });
}

export function useSetWatchTarget() {
  const invalidate = useWatchInvalidation();
  return useMutation({
    mutationFn: ({ id, target }: { id: number; target: number | null }) =>
      api.setWatchTarget(id, target),
    onSuccess: invalidate,
  });
}
