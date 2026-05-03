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
