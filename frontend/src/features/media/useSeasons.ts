import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  type MediaType,
  type SeasonSelection,
  type Series,
  type SetCurrentSeason,
} from "../../lib/api-client";
import { listEntryScopes, queryKeys } from "../../lib/queryKeys";

/**
 * Every member of the series a title belongs to.
 *
 * Keyed by the member asked about rather than by the show: the client does not know
 * the chain's root until the first answer arrives. Every member returns the same
 * series, so the page can seed a sibling's cache entry when the viewer moves and the
 * move paints from data already in hand.
 */
export function useSeries(provider: string, providerId: string, type: MediaType) {
  return useQuery({
    queryKey: queryKeys.series(provider, providerId),
    queryFn: () => api.series(provider, providerId, type),
    enabled: providerId.length > 0,
  });
}

/** The current season per show as `{ [root_provider_id]: provider_id }`, for the grids. */
export function useSeasonSelections() {
  return useQuery({
    queryKey: queryKeys.seasonSelections,
    queryFn: api.seasonSelections,
    staleTime: 5 * 60 * 1000,
    select: (rows: SeasonSelection[]) =>
      Object.fromEntries(rows.map((r) => [r.root_provider_id, r.provider_id])),
  });
}

/**
 * Move the user to a season.
 *
 * The only writer of "current season", and it runs only when the user asks — opening
 * a season's page is a read. The new state is painted into every cached copy of the
 * series before the request goes out so the badge moves under the pointer, and the
 * server's answer then replaces it.
 *
 * `start` and `complete_provider_id` ride along on the same call, so "you finished
 * season 3, start season 4?" cannot half-apply and leave the series disagreeing
 * about where the user is.
 */
export function useSetCurrentSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ root, ...input }: SetCurrentSeason & { root: string }) =>
      api.setCurrentSeason(root, input),

    onMutate: ({ root, provider_id }) => {
      const previous = queryClient.getQueriesData<Series>({ queryKey: ["series"] });
      const selections = queryClient.getQueryData<SeasonSelection[]>(queryKeys.seasonSelections);

      queryClient.setQueriesData<Series>({ queryKey: ["series"] }, (old) =>
        old && old.root_provider_id === root
          ? {
              ...old,
              current_provider_id: provider_id,
              is_explicit: true,
              seasons: old.seasons.map((s) => ({
                ...s,
                is_current: s.media.provider_id === provider_id,
              })),
            }
          : old,
      );
      queryClient.setQueryData<SeasonSelection[]>(queryKeys.seasonSelections, (old) => [
        ...(old ?? []).filter((s) => s.root_provider_id !== root),
        { root_provider_id: root, provider_id },
      ]);

      return { previous, selections };
    },

    onError: (_error, _variables, context) => {
      for (const [key, value] of context?.previous ?? []) {
        queryClient.setQueryData(key, value);
      }
      queryClient.setQueryData(queryKeys.seasonSelections, context?.selections);
    },

    onSuccess: (series) => {
      // Every cached member of this series now holds the server's own answer.
      queryClient.setQueriesData<Series>({ queryKey: ["series"] }, (old) =>
        old && old.root_provider_id === series.root_provider_id ? series : old,
      );
      // `start` and `complete_provider_id` write entries, so the library, the
      // dashboard and this title's own entry query are all stale now.
      for (const key of listEntryScopes) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.seasonSelections });
    },
  });
}
