import type { StaffIdentity } from "@workspace/api-client-react";

export const ADMIN_SESSION_KEY = "hkm_admin_session";
export const SESSION_EXPIRED_EVENT = "hkm:session-expired";

export function getStoredAdminToken(): string | null {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(ADMIN_SESSION_KEY)
      : null;
  } catch {
    return null;
  }
}

export function storeAdminToken(token: string) {
  try {
    localStorage.setItem(ADMIN_SESSION_KEY, token);
  } catch {
  }
}

export function clearAdminToken() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
  }
}

export function notifySessionExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

export async function apiAdminLogin(password: string): Promise<string> {
  const res = await fetch("/api/admin/auth", {
    cache: "no-store",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Invalid password");
  }
  const data = await res.json();
  return data.token as string;
}

export async function apiCheckAdminSession(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/auth", {
      cache: "no-store",
      headers: { "x-session-token": token },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

export async function apiAdminLogout(token: string): Promise<void> {
  try {
    await fetch("/api/admin/auth", {
      method: "DELETE",
      headers: { "x-session-token": token },
    });
  } catch {
  }
}

export type StaffIdentityPayload = StaffIdentity;

export type AuthIdentity =
  | { kind: "admin" }
  | { kind: "staff"; staff: StaffIdentityPayload };

/** Returns identity, or null when the session is invalid/revoked. Throws on network failure. */
export async function apiGetAuthIdentity(token: string): Promise<AuthIdentity | null> {
  const res = await fetch("/api/admin/auth", {
    cache: "no-store",
    headers: { "x-session-token": token },
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Session check failed (${res.status})`);
  const data = await res.json();
  if (!data?.authenticated) return null;
  if (data.kind === "staff" && data.staff) {
    return { kind: "staff", staff: data.staff as StaffIdentityPayload };
  }
  return { kind: "admin" };
}

export function identityFingerprint(identity: AuthIdentity | null): string {
  if (!identity) return "none";
  if (identity.kind === "admin") return "admin";
  const s = identity.staff;
  const grants = [...s.grants]
    .sort((a, b) => a.id - b.id)
    .map((g) => `${g.id}:${g.version}:${g.teamId}:${g.manageAttendance ? 1 : 0}${g.manageSchedule ? 1 : 0}${g.manageLineups ? 1 : 0}:${g.revokedAt ? "r" : "a"}`)
    .join(",");
  return `staff:${s.playerId}:${s.seasonId}:${grants}`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return (data && (data.error || data.message)) || fallback;
}

export async function apiRequestPlayerCode(email: string): Promise<void> {
  const res = await fetch("/api/player-auth/request-code", {
    cache: "no-store",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not send a code to that email"));
}

/** Verifies the code and returns ONLY the short-lived player session token. The full response is discarded. */
export async function apiVerifyPlayerCode(email: string, code: string): Promise<string> {
  const res = await fetch("/api/player-auth/verify-code", {
    cache: "no-store",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) throw new Error(await readError(res, "That code is not valid"));
  const data = await res.json().catch(() => null);
  const token = data && typeof data.sessionToken === "string" ? data.sessionToken : null;
  if (!token) throw new Error("Sign-in did not return a session");
  return token;
}
