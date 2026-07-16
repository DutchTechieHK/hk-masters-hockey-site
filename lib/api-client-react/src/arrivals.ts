import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface ArrivalEntry {
  id: number;
  name: string;
  arrival: string;
  arrivalCity: string | null;
  travelNote: string | null;
  teamCategory: string | null;
  teamName: string | null;
}

export interface NoArrivalEntry {
  id: number;
  name: string;
  teamCategory: string | null;
  teamName: string | null;
}

export interface DepartureEntry {
  id: number;
  name: string;
  departure: string;
  departureCity: string | null;
  departureNote: string | null;
  teamCategory: string | null;
  teamName: string | null;
}

export interface NoDepartureEntry {
  id: number;
  name: string;
  teamCategory: string | null;
  teamName: string | null;
}

export interface AdminArrivalsResponse {
  withArrival: ArrivalEntry[];
  withoutArrival: NoArrivalEntry[];
  withDeparture: DepartureEntry[];
  withoutDeparture: NoDepartureEntry[];
}

export const getAdminArrivalsQueryKey = () => ["/api/players/arrivals"] as const;

export const getAdminArrivals = async (): Promise<AdminArrivalsResponse> => {
  return customFetch<AdminArrivalsResponse>("/api/players/arrivals", {
    method: "GET",
  });
};

export function useGetAdminArrivals<TData = AdminArrivalsResponse, TError = ErrorType<unknown>>(
  queryOptions?: Partial<UseQueryOptions<AdminArrivalsResponse, TError, TData, QueryKey>>
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = queryOptions?.queryKey ?? getAdminArrivalsQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: () => getAdminArrivals(),
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  query.queryKey = queryKey;
  return query;
}
