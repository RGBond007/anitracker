import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../lib/api-client";
import { listEntryScopes, queryKeys } from "../../lib/queryKeys";

export function useStartImport() {
  return useMutation({ mutationFn: api.importMal });
}

/** Polls once a second while the job is live, then stops and refreshes the lists. */
export function useImportJob(jobId: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.importJob(jobId ?? 0),
    queryFn: async () => {
      const job = await api.importJob(jobId!);
      if (job.state === "done" || job.state === "failed") {
        for (const key of listEntryScopes) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }
      return job;
    },
    enabled: jobId != null,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "done" || state === "failed" ? false : 1000;
    },
  });
}
