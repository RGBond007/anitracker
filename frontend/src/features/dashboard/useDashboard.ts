import { useQuery } from "@tanstack/react-query";

import { api } from "../../lib/api-client";
import { queryKeys } from "../../lib/queryKeys";

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
}
