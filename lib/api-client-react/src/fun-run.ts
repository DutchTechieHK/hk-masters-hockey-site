import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface FunRunSummary {
  total: number;
  count: number;
  byCategory: {
    entry_fee: number;
    pledge: number;
    drinks_cookies: number;
    other: number;
  };
}

export const getFunRunSummaryQueryKey = () => ["/api/fun-run/summary"] as const;

export const getFunRunSummary = async (): Promise<FunRunSummary> => {
  return customFetch<FunRunSummary>("/api/fun-run/summary", {
    method: "GET",
  });
};

export function useGetFunRunSummary<TData = FunRunSummary, TError = ErrorType<unknown>>(
  queryOptions?: Partial<UseQueryOptions<FunRunSummary, TError, TData, QueryKey>>
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = queryOptions?.queryKey ?? getFunRunSummaryQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: () => getFunRunSummary(),
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  query.queryKey = queryKey;
  return query;
}
