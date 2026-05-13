export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export function resolveMediaUrl(url) {
  if (!url) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}
