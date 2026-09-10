import { useQuery } from "@tanstack/react-query"
import { getStoredAdminToken } from "@/lib/admin-auth"
import { useListFundraising, getListFundraisingQueryKey } from "@workspace/api-client-react"

export function useScopedFundraising(scope?: string, sessionToken?: string) {
  const { data: defaultData = [], isLoading: defaultLoading, refetch: defaultRefetch, isError: defaultError } = useListFundraising({ query: { queryKey: getListFundraisingQueryKey(), enabled: !scope && !!sessionToken } } as any)
  
  const { data: archiveData = [], isLoading: archiveLoading, refetch: archiveRefetch, isError: archiveError } = useQuery({
    queryKey: ["fundraising", scope],
    queryFn: async () => {
      const token = sessionToken || getStoredAdminToken()
      const headers = { "Content-Type": "application/json", ...(token ? { "x-session-token": token } : {}) }
      const res = await fetch(`/api/fundraising?scope=${scope}`, { headers })
      if (!res.ok) throw new Error("Failed to load fundraising")
      return res.json() as Promise<any[]>
    },
    enabled: !!scope && !!(sessionToken || getStoredAdminToken())
  })

  return {
    data: scope ? archiveData : defaultData,
    isLoading: scope ? archiveLoading : defaultLoading,
    refetch: scope ? archiveRefetch : defaultRefetch,
    isError: scope ? archiveError : defaultError
  }
}
