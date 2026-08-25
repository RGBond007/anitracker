import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import i18n from "../../lib/i18n";
import { api } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";
import { useUiStore } from "../../stores/uiStore";

/**
 * Every shelf write invalidates both the index and the shelf itself: the index
 * carries the counts a card shows, and a stale count beside a shelf you just added
 * to is the one error the user is guaranteed to notice.
 */
function useShelfInvalidation() {
  const queryClient = useQueryClient();
  return (id?: number) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shelves });
    if (id !== undefined) void queryClient.invalidateQueries({ queryKey: queryKeys.shelf(id) });
  };
}

export function useShelves() {
  return useQuery({ queryKey: queryKeys.shelves, queryFn: api.shelves });
}

export function useShelf(id: number | null) {
  return useQuery({
    queryKey: queryKeys.shelf(id ?? 0),
    queryFn: () => api.shelf(id as number),
    enabled: id !== null,
  });
}

export function useCreateShelf() {
  const invalidate = useShelfInvalidation();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: api.createShelf,
    onSuccess: (shelf) => {
      invalidate();
      // Translated through `i18n` rather than `useTranslation`, which is not
      // available outside a component. Note the other toasts in the app are still
      // hardcoded English -- this one is not the place to fix that, but it is not
      // the place to copy it either.
      toast(i18n.t("shelf.created", { name: shelf.name }));
    },
  });
}

export function useUpdateShelf() {
  const invalidate = useShelfInvalidation();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) =>
      api.updateShelf(id, patch),
    onSuccess: (shelf) => invalidate(shelf.id),
  });
}

export function useDeleteShelf() {
  const invalidate = useShelfInvalidation();
  return useMutation({
    mutationFn: api.deleteShelf,
    onSuccess: () => invalidate(),
  });
}

/**
 * Add and remove are one hook because the control that calls them is one toggle.
 * No toast: shelving is a high-frequency action taken from a menu that already
 * shows the result as a tick, and the same reasoning applies here as to `+1`.
 */
export function useShelveEntry() {
  const invalidate = useShelfInvalidation();
  return useMutation({
    // Returns nothing on purpose: add answers with the whole shelf and remove with
    // 204, and a caller that had to branch on which it got would be encoding the
    // toggle's direction twice. The invalidation below is what refreshes the view.
    mutationFn: async ({ id, entryId, on }: { id: number; entryId: number; on: boolean }) => {
      if (on) await api.addToShelf(id, entryId);
      else await api.removeFromShelf(id, entryId);
    },
    onSuccess: (_result, variables) => invalidate(variables.id),
  });
}

export function useReorderShelf() {
  const invalidate = useShelfInvalidation();
  return useMutation({
    mutationFn: ({ id, entryIds }: { id: number; entryIds: number[] }) =>
      api.reorderShelf(id, entryIds),
    onSuccess: (shelf) => invalidate(shelf.id),
  });
}
