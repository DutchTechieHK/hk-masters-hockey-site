import { useQuery } from "@tanstack/react-query"
import { getStoredAdminToken } from "@/lib/admin-auth"
import { useListPlayers, useListTeams } from "@workspace/api-client-react"

export function useScopedPlayers(scope?: string) {
  const { data: defaultData = [], isLoading: defaultLoading, refetch: defaultRefetch } = useListPlayers({}, { query: { enabled: !scope } } as any)
  
  const { data: archiveData = [], isLoading: archiveLoading, refetch: archiveRefetch } = useQuery({
    queryKey: ["players", scope],
    queryFn: async () => {
      const token = getStoredAdminToken()
      const headers = { "Content-Type": "application/json", ...(token ? { "x-session-token": token } : {}) }
      const res = await fetch(`/api/players?scope=${scope}`, { headers })
      if (!res.ok) throw new Error("Failed to load players")
      return res.json() as Promise<any[]>
    },
    enabled: !!scope
  })

  return {
    data: scope ? archiveData : defaultData,
    isLoading: scope ? archiveLoading : defaultLoading,
    refetch: scope ? archiveRefetch : defaultRefetch
  }
}

export function useScopedTeams(scope?: string) {
  const { data: defaultData = [], isLoading: defaultLoading, refetch: defaultRefetch } = useListTeams({}, { query: { enabled: !scope } } as any)
  
  const { data: archiveData = [], isLoading: archiveLoading, refetch: archiveRefetch } = useQuery({
    queryKey: ["teams", scope],
    queryFn: async () => {
      const token = getStoredAdminToken()
      const headers = { "Content-Type": "application/json", ...(token ? { "x-session-token": token } : {}) }
      const res = await fetch(`/api/teams?scope=${scope}`, { headers })
      if (!res.ok) throw new Error("Failed to load teams")
      return res.json() as Promise<any[]>
    },
    enabled: !!scope
  })

  return {
    data: scope ? archiveData : defaultData,
    isLoading: scope ? archiveLoading : defaultLoading,
    refetch: scope ? archiveRefetch : defaultRefetch
  }
}
