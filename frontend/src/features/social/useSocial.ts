import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../lib/api-client";
import { friendScopes, queryKeys } from "../../lib/queryKeys";
import { useUiStore } from "../../stores/uiStore";

export function useFriends() {
  return useQuery({ queryKey: queryKeys.friends, queryFn: api.friends });
}

export function useFeed() {
  return useQuery({ queryKey: queryKeys.feed, queryFn: api.feed });
}

/** Accounts you have no link with yet. Empty on a single-user instance. */
export function useDiscover() {
  return useQuery({ queryKey: queryKeys.discover, queryFn: api.discover });
}

export function useLeaderboard() {
  return useQuery({ queryKey: queryKeys.leaderboard, queryFn: api.leaderboard });
}

/** Typeahead for the add-a-friend box. Idle until something is typed. */
export function useUserSearch(q: string) {
  return useQuery({
    queryKey: queryKeys.userSearch(q),
    queryFn: () => api.searchUsers(q),
    enabled: q.trim().length > 0,
    staleTime: 30 * 1000,
  });
}

export function useProfile(username: string) {
  return useQuery({
    queryKey: queryKeys.profile(username),
    queryFn: () => api.profile(username),
    enabled: username.length > 0,
  });
}

/**
 * Only fetched once the profile says the list is visible — asking anyway would
 * just 403, and react-query would treat that as a retryable error.
 */
export function useComparison(username: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.compare(username),
    queryFn: () => api.compare(username),
    enabled: enabled && username.length > 0,
  });
}

function useFriendInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of friendScopes) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

export function useSendFriendRequest() {
  const invalidate = useFriendInvalidation();
  const toast = useUiStore((s) => s.toast);
  const { t } = useTranslation();
  return useMutation({
    mutationFn: api.sendFriendRequest,
    onSuccess: (friendship) => {
      invalidate();
      // The API turns "they already asked you" into an accept, so the message has
      // to follow what actually happened rather than what was clicked.
      toast(
        friendship.state === "accepted"
          ? t("friends.nowFriends", { name: friendship.user.username })
          : t("friends.requestSent", { name: friendship.user.username }),
      );
    },
    onError: (error: Error) => toast(error.message),
  });
}

export function useAcceptFriendRequest() {
  const invalidate = useFriendInvalidation();
  const toast = useUiStore((s) => s.toast);
  const { t } = useTranslation();
  return useMutation({
    mutationFn: api.acceptFriendRequest,
    onSuccess: (friendship) => {
      invalidate();
      toast(t("friends.nowFriends", { name: friendship.user.username }));
    },
    onError: (error: Error) => toast(error.message),
  });
}

export function useDeclineFriendRequest() {
  const invalidate = useFriendInvalidation();
  return useMutation({ mutationFn: api.declineFriendRequest, onSuccess: invalidate });
}

export function useRemoveFriend() {
  const invalidate = useFriendInvalidation();
  return useMutation({ mutationFn: api.removeFriend, onSuccess: invalidate });
}
