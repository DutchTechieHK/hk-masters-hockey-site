import { getStoredAdminToken } from "@/lib/admin-auth"

export type { MemberGroup } from "@workspace/api-client-react"
import type { MemberGroup, GroupCandidateMember } from "@workspace/api-client-react"
export type GroupMemberOption = GroupCandidateMember

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function groupAuthHeaders(): Record<string, string> {
  const token = getStoredAdminToken()
  return token ? { "x-session-token": token } : {}
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...groupAuthHeaders(), ...(init.headers as Record<string, string> | undefined) },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const fetchGroups = () => request<MemberGroup[]>("/api/groups")
export const fetchGroupMembers = () => request<GroupMemberOption[]>("/api/groups/members")
export const createGroup = (body: { name: string; description: string | null; memberIds: number[] }) =>
  request<MemberGroup>("/api/groups", { method: "POST", body: JSON.stringify(body) })
export const updateGroup = (id: number, body: { name: string; description: string | null; memberIds: number[]; version: number }) =>
  request<MemberGroup>(`/api/groups/${id}`, { method: "PATCH", body: JSON.stringify(body) })
export const deleteGroup = (id: number, version: number) =>
  request<void>(`/api/groups/${id}?version=${version}`, { method: "DELETE" })
