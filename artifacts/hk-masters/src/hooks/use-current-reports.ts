import { useQuery } from "@tanstack/react-query";
import { getStoredAdminToken, notifySessionExpired } from "@/lib/admin-auth";

export type CurrentMember = {
  id: number; name: string; email: string | null; memberStatus: string;
  section: string; tier: string; teamId: number | null; teamName: string | null;
  due: number | null; paid: number; feePaid: boolean; lastPaymentDate: string | null;
};
export type CurrentPayment = {
  id: number; playerId: number; playerName: string; teamId: number | null;
  teamName: string | null; method: string; amount: number; paymentDate: string;
};
export type CurrentSession = {
  id: number; title: string; date: string; teamId: number | null; teamName: string | null;
  counts: { yes: number; maybe: number; no: number; noResponse: number; invited: number };
  responses: {
    playerId: number; playerName: string; teamName: string | null;
    status: "yes" | "maybe" | "no" | "none"; respondedAt: string | null;
  }[];
};
export type CurrentReportsData = {
  season: string; members: CurrentMember[]; payments: CurrentPayment[];
  training: CurrentSession[]; matches: CurrentSession[];
};

export function useCurrentReports() {
  return useQuery<CurrentReportsData>({
    queryKey: ["reports", "current"],
    queryFn: async () => {
      const token = getStoredAdminToken();
      if (!token) throw new Error("Your admin session is unavailable. Sign in again.");
      const response = await fetch("/api/reports/current", {
        headers: { "x-session-token": token },
        credentials: "include",
      });
      if (response.status === 401 || response.status === 403) notifySessionExpired();
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? "Your session has expired. Sign in again."
        : "The current reports could not be loaded. Please retry.");
      return response.json();
    },
  });
}