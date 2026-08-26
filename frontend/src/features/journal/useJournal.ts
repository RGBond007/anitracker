import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Mood } from "../../lib/api-client";
import { api } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";

/** A write touches both the title's own list and the timeline that aggregates it. */
function useJournalInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["journal-for"] });
    void queryClient.invalidateQueries({ queryKey: ["journal-timeline"] });
  };
}

export function useJournalFor(entryId: number | null) {
  return useQuery({
    queryKey: queryKeys.journalFor(entryId ?? 0),
    queryFn: () => api.journalFor(entryId as number),
    enabled: entryId !== null,
  });
}

export function useJournalTimeline(favoritesOnly = false) {
  return useQuery({
    queryKey: queryKeys.journalTimeline(favoritesOnly),
    queryFn: () => api.journalTimeline(favoritesOnly),
  });
}

export function useWriteJournal() {
  const invalidate = useJournalInvalidation();
  return useMutation({
    mutationFn: ({
      entryId,
      ...input
    }: {
      entryId: number;
      unit: number;
      note?: string | null;
      mood?: Mood | null;
      is_favorite?: boolean;
      has_spoilers?: boolean;
    }) => api.journalWrite(entryId, input),
    onSuccess: invalidate,
  });
}

export function useAmendJournal() {
  const invalidate = useJournalInvalidation();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) =>
      api.journalAmend(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteJournal() {
  const invalidate = useJournalInvalidation();
  return useMutation({ mutationFn: api.journalDelete, onSuccess: invalidate });
}
