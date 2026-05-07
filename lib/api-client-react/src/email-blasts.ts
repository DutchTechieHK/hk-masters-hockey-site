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

export interface OnboardingInviteLogItem {
  id: number;
  name: string;
  email: string;
  teamName: string | null;
  invitedAt: string;
}

export const getListOnboardingInviteLogQueryKey = () => ["/api/players/onboarding-invite-log"] as const;

export const listOnboardingInviteLog = async (options?: RequestInit): Promise<OnboardingInviteLogItem[]> => {
  return customFetch<OnboardingInviteLogItem[]>("/api/players/onboarding-invite-log", {
    ...options,
    method: "GET",
  });
};

export function useListOnboardingInviteLog<TData = OnboardingInviteLogItem[], TError = ErrorType<unknown>>(
  queryOptions?: Partial<UseQueryOptions<OnboardingInviteLogItem[], TError, TData, QueryKey>>
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = queryOptions?.queryKey ?? getListOnboardingInviteLogQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: () => listOnboardingInviteLog(),
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  query.queryKey = queryKey;
  return query;
}
