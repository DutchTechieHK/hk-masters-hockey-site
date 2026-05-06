import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult, QueryKey, UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";
import type { EmailTemplate, CreateEmailTemplateBody } from "./generated/api.schemas";

export const getListEmailTemplatesQueryKey = () => ["/api/email-templates"] as const;

export const listEmailTemplates = async (options?: RequestInit): Promise<EmailTemplate[]> => {
  return customFetch<EmailTemplate[]>("/api/email-templates", {
    ...options,
    method: "GET",
  });
};

export function useListEmailTemplates<TData = EmailTemplate[], TError = ErrorType<unknown>>(
  queryOptions?: Partial<UseQueryOptions<EmailTemplate[], TError, TData, QueryKey>>
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = queryOptions?.queryKey ?? getListEmailTemplatesQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: () => listEmailTemplates(),
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  query.queryKey = queryKey;
  return query;
}

export const createEmailTemplate = async (body: CreateEmailTemplateBody): Promise<EmailTemplate> => {
  return customFetch<EmailTemplate>("/api/email-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

export function useCreateEmailTemplate(
  mutationOptions?: UseMutationOptions<EmailTemplate, ErrorType<unknown>, CreateEmailTemplateBody>
): UseMutationResult<EmailTemplate, ErrorType<unknown>, CreateEmailTemplateBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEmailTemplate,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
      mutationOptions?.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}

export const deleteEmailTemplate = async (id: number): Promise<void> => {
  return customFetch<void>(`/api/email-templates/${id}`, {
    method: "DELETE",
  });
};

export function useDeleteEmailTemplate(
  mutationOptions?: UseMutationOptions<void, ErrorType<unknown>, number>
): UseMutationResult<void, ErrorType<unknown>, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEmailTemplate,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
      mutationOptions?.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}
