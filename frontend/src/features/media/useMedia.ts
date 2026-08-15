import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type EntryStatus, type MediaType } from "../../lib/api-client";
import { listEntryScopes, queryKeys } from "../../lib/queryKeys";
import { useUiStore } from "../../stores/uiStore";

export function useSearch(query: string, type: MediaType) {
  return useQuery({
    queryKey: queryKeys.search(query, type),
    queryFn: () => api.search(query, type),
    enabled: query.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMediaDetail(provider: string, providerId: string, type: MediaType) {
  return useQuery({
    queryKey: queryKeys.media(provider, providerId, type),
    queryFn: () => api.media(provider, providerId, type),
  });
}

export function useEntryForMedia(provider: string, providerId: string) {
  return useQuery({
    queryKey: queryKeys.entryForMedia(provider, providerId),
    queryFn: () => api.entryForMedia(provider, providerId),
  });
}

export function useEntries(filters: { type?: MediaType; status?: EntryStatus; sort?: string }) {
  return useQuery({
    queryKey: queryKeys.entries(filters),
    queryFn: () => api.entries(filters),
  });
}

function useEntryInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of listEntryScopes) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

export function useAddEntry() {
  const invalidate = useEntryInvalidation();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: api.addEntry,
    onSuccess: () => {
      invalidate();
      toast("Entry added");
    },
  });
}

export function useUpdateEntry() {
  const invalidate = useEntryInvalidation();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) =>
      api.updateEntry(id, patch),
    onSuccess: () => {
      invalidate();
      toast("Entry saved");
    },
  });
}

/** No toast: +1 is a high-frequency action and a toast per click is noise. */
export function useIncrementEntry() {
  const invalidate = useEntryInvalidation();
  return useMutation({ mutationFn: api.incrementEntry, onSuccess: invalidate });
}

export function useDeleteEntry() {
  const invalidate = useEntryInvalidation();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: api.deleteEntry,
    onSuccess: () => {
      invalidate();
      toast("Entry removed");
    },
  });
}
