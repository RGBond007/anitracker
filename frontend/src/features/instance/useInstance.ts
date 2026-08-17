import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";
import { useUiStore } from "../../stores/uiStore";

export function useInstance() {
  return useQuery({
    queryKey: queryKeys.instance,
    queryFn: api.instance,
    staleTime: 5 * 60 * 1000,
  });
}

/** `silent` leaves the confirmation to the caller — see `useUpdateProfile`. */
export function useUpdateInstance({ silent = false }: { silent?: boolean } = {}) {
  const queryClient = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: api.updateInstance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.instance });
      if (!silent) toast("Instance updated");
    },
  });
}
