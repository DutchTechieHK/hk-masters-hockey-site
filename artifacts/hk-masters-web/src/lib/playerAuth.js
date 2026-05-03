import { API_BASE } from "../utils/api";

const TOKEN_KEY = "hkm_player_session";

export function getPlayerToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPlayerToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore (private browsing etc.)
  }
}

export function clearPlayerToken() {
  setPlayerToken(null);
}

async function jsonOrThrow(res) {
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function requestLoginCode(email) {
  const res = await fetch(`${API_BASE}/api/player-auth/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return jsonOrThrow(res);
}

export async function verifyLoginCode(email, code) {
  const res = await fetch(`${API_BASE}/api/player-auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const data = await jsonOrThrow(res);
  if (data?.sessionToken) setPlayerToken(data.sessionToken);
  return data;
}

export async function fetchMe() {
  const token = getPlayerToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/api/player-auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearPlayerToken();
    return null;
  }
  return jsonOrThrow(res);
}

export async function logout() {
  const token = getPlayerToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/api/player-auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ }
  }
  clearPlayerToken();
}
