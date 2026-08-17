import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type MediaType, type SeasonSelection, type Series } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";

/**
 * Every season of the show a title belongs to.
 *
 * Keyed by the season asked about rather than by the show: the client does not know
 * the chain's root until the first answer arrives. Every member returns the same
 * chain, so the page can seed a sibling's cache entry when switching season and the
 * switch paints from data already in hand.
 */
export function useSeries(provider: string, providerId: string, type: MediaType) {
  return useQuery({
    queryKey: queryKeys.series(provider, providerId),
    queryFn: () => api.series(provider, providerId, type),
    enabled: providerId.length > 0,
  });
}

/** The saved picks as `{ [root_provider_id]: provider_id }`, for the library grids. */
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
 * Remember which season the user is on.
 *
 * The pick is painted into every cached copy of the series before the request goes
 * out, so the highlight moves under the pointer rather than a round trip later; the
 * server's answer then replaces it, and a failure rolls the caches back.
 */
export function useSelectSeason() {
  const queryClient = useQueryClient();

  const patchSeries = (root: string, providerId: string) =>
    queryClient.setQueriesData<Series>({ queryKey: ["series"] }, (old) =>
      old && old.root_provider_id === root
        ? { ...old, selected_provider_id: providerId, is_explicit: true }
        : old,
    );

  return useMutation({
    mutationFn: ({ root, providerId }: { root: string; providerId: string }) =>
      api.selectSeason(root, providerId),

    onMutate: ({ root, providerId }) => {
      const series = queryClient.getQueriesData<Series>({ queryKey: ["series"] });
      const selections = queryClient.getQueryData<SeasonSelection[]>(queryKeys.seasonSelections);

      patchSeries(root, providerId);
      queryClient.setQueryData<SeasonSelection[]>(queryKeys.seasonSelections, (old) => [
        ...(old ?? []).filter((s) => s.root_provider_id !== root),
        { root_provider_id: root, provider_id: providerId },
      ]);

      return { series, selections };
    },

    onError: (_error, _variables, context) => {
      for (const [key, value] of context?.series ?? []) {
        queryClient.setQueryData(key, value);
      }
      queryClient.setQueryData(queryKeys.seasonSelections, context?.selections);
    },

    onSuccess: (series) => {
      // Every cached member of this chain now holds the server's own answer.
      queryClient.setQueriesData<Series>({ queryKey: ["series"] }, (old) =>
        old && old.root_provider_id === series.root_provider_id ? series : old,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.seasonSelections });
    },
  });
}
