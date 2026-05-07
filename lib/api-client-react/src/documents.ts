import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult, QueryKey, UseMutationResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface DocumentItem {
  id: number;
  title: string;
  description?: string | null;
  category: "mandatory-form" | "regulation" | "information";
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  uploadedByEmail?: string | null;
  uploadedAt?: string;
}

export interface CreateDocumentInput {
  title: string;
  description?: string;
  category: "mandatory-form" | "regulation" | "information";
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  uploadedByEmail?: string;
}

export const getListDocumentsQueryKey = () => ["/api/documents"] as const;

export const listDocuments = async (options?: RequestInit): Promise<DocumentItem[]> => {
  return customFetch<DocumentItem[]>("/api/documents", {
    ...options,
    method: "GET",
  });
};

export function useListDocuments<TData = DocumentItem[], TError = ErrorType<unknown>>(
  queryOptions?: Partial<UseQueryOptions<DocumentItem[], TError, TData, QueryKey>>
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = queryOptions?.queryKey ?? getListDocumentsQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: () => listDocuments(),
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  query.queryKey = queryKey;
  return query;
}

export const createDocument = async (data: CreateDocumentInput): Promise<DocumentItem> => {
  return customFetch<DocumentItem>("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};

export function useCreateDocument(): UseMutationResult<DocumentItem, ErrorType<unknown>, CreateDocumentInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
    },
  });
}

export const deleteDocument = async (id: number): Promise<void> => {
  return customFetch<void>(`/api/documents/${id}`, {
    method: "DELETE",
  });
};

export function useDeleteDocument(): UseMutationResult<void, ErrorType<unknown>, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
    },
  });
}
