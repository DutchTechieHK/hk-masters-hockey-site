import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";
import type { EmailBlastItem } from "./generated/api.schemas";

export const getListEmailBlastsQueryKey = () => ["/api/players/email-blasts"] as const;

export const listEmailBlasts = async (options?: RequestInit): Promise<EmailBlastItem[]> => {
  return customFetch<EmailBlastItem[]>("/api/players/email-blasts", {
    ...options,
    method: "GET",
  });
};

export function useListEmailBlasts<TData = EmailBlastItem[], TError = ErrorType<unknown>>(
  queryOptions?: Partial<UseQueryOptions<EmailBlastItem[], TError, TData, QueryKey>>
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = queryOptions?.queryKey ?? getListEmailBlastsQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: () => listEmailBlasts(),
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  query.queryKey = queryKey;
  return query;
}
