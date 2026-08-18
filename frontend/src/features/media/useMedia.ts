import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Entry, type EntryStatus, type MediaType } from "../../lib/api-client";
import { listEntryScopes, queryKeys } from "../../lib/queryKeys";
import { useUiStore } from "../../stores/uiStore";

export function useSearch(query: string, type: MediaType, genres: string[] = []) {
  return useQuery({
    queryKey: queryKeys.search(query, type, genres),
    queryFn: () => api.search(query, type, 1, genres),
    // A genre on its own is a search: picking one with an empty box browses it.
    enabled: query.trim().length > 0 || genres.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The titles shown while the search box is empty. One answer for the whole
 * instance and cached upstream too, so it is deliberately stale-tolerant.
 */
export function useTrending(type: MediaType) {
  return useQuery({
    queryKey: queryKeys.trending(type),
    queryFn: () => api.trending(type),
    staleTime: 30 * 60 * 1000,
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

/**
 * The same arithmetic the increment endpoint does, applied to a cached entry.
 *
 * Kept in step with `backend/app/routers/entries.py` deliberately: the optimistic
 * copy has to agree with the answer that replaces it a moment later, or the
 * progress bar moves twice.
 */
function bumped(entry: Entry): Entry {
  const total = entry.media.total_units;
  const progress = total ? Math.min(entry.progress + 1, total) : entry.progress + 1;
  const status: EntryStatus =
    total && progress >= total
      ? "completed"
      : entry.status === "planned" || entry.status === "on_hold"
        ? "current"
        : entry.status;
  return { ...entry, progress, status };
}

/** No toast: +1 is a high-frequency action and a toast per click is noise. */
export function useIncrementEntry() {
  const queryClient = useQueryClient();
  const invalidate = useEntryInvalidation();

  return useMutation({
    mutationFn: api.incrementEntry,

    // The bar has to move under the pointer rather than a round trip later, so
    // the count is written into the cache first and the server's own answer
    // replaces it when it lands.
    onMutate: (id: number) => {
      const previous = queryClient.getQueriesData<Entry | null>({
        queryKey: ["entry-for-media"],
      });
      queryClient.setQueriesData<Entry | null>({ queryKey: ["entry-for-media"] }, (old) =>
        old && old.id === id ? bumped(old) : old,
      );
      return { previous };
    },

    onError: (_error, _id, context) => {
      for (const [key, value] of context?.previous ?? []) {
        queryClient.setQueryData(key, value);
      }
    },

    onSettled: invalidate,
  });
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
