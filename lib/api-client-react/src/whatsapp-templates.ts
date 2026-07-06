import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult, QueryKey, UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";
import type { WhatsappTemplate, CreateWhatsappTemplateBody, UpdateWhatsappTemplateBody, UpdateWhatsappTemplateVariables } from "./generated/api.schemas";

export const getListWhatsappTemplatesQueryKey = () => ["/api/whatsapp-templates"] as const;

export const listWhatsappTemplates = async (options?: RequestInit): Promise<WhatsappTemplate[]> => {
  return customFetch<WhatsappTemplate[]>("/api/whatsapp-templates", {
    ...options,
    method: "GET",
  });
};

export function useListWhatsappTemplates<TData = WhatsappTemplate[], TError = ErrorType<unknown>>(
  queryOptions?: Partial<UseQueryOptions<WhatsappTemplate[], TError, TData, QueryKey>>
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = queryOptions?.queryKey ?? getListWhatsappTemplatesQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: () => listWhatsappTemplates(),
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  query.queryKey = queryKey;
  return query;
}

export const createWhatsappTemplate = async (body: CreateWhatsappTemplateBody): Promise<WhatsappTemplate> => {
  return customFetch<WhatsappTemplate>("/api/whatsapp-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

export function useCreateWhatsappTemplate(
  mutationOptions?: UseMutationOptions<WhatsappTemplate, ErrorType<unknown>, CreateWhatsappTemplateBody>
): UseMutationResult<WhatsappTemplate, ErrorType<unknown>, CreateWhatsappTemplateBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWhatsappTemplate,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: getListWhatsappTemplatesQueryKey() });
      mutationOptions?.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}

export const updateWhatsappTemplate = async ({ id, body }: UpdateWhatsappTemplateVariables): Promise<WhatsappTemplate> => {
  return customFetch<WhatsappTemplate>(`/api/whatsapp-templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

export function useUpdateWhatsappTemplate(
  mutationOptions?: UseMutationOptions<WhatsappTemplate, ErrorType<unknown>, UpdateWhatsappTemplateVariables>
): UseMutationResult<WhatsappTemplate, ErrorType<unknown>, UpdateWhatsappTemplateVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateWhatsappTemplate,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: getListWhatsappTemplatesQueryKey() });
      mutationOptions?.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}

export const deleteWhatsappTemplate = async (id: number): Promise<void> => {
  return customFetch<void>(`/api/whatsapp-templates/${id}`, {
    method: "DELETE",
  });
};

export function useDeleteWhatsappTemplate(
  mutationOptions?: UseMutationOptions<void, ErrorType<unknown>, number>
): UseMutationResult<void, ErrorType<unknown>, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWhatsappTemplate,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: getListWhatsappTemplatesQueryKey() });
      mutationOptions?.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}
