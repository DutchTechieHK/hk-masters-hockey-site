const HK_OFFSET_MS = 8 * 60 * 60 * 1000;

/** ISO instant -> "YYYY-MM-DDTHH:mm" in Hong Kong local time (UTC+8, no DST). */
export function isoToHkInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + HK_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" interpreted as Hong Kong local time -> ISO instant. */
export function hkInputToIso(value: string): string | null {
  if (!value) return null;
  const t = Date.parse(`${value}:00+08:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const fmtDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", weekday: "short", day: "numeric", month: "short" });
const fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtFull = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export const hkDay = (iso: string) => fmtDay.format(new Date(iso));
export const hkTime = (iso: string) => fmtTime.format(new Date(iso));
export const hkFull = (iso: string) => fmtFull.format(new Date(iso));

export function errorStatus(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return null;
}

export function explainError(err: unknown, fallback = "Something went wrong"): string {
  const status = errorStatus(err);
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403) return "Not permitted. Your staff access for this team may have been changed or revoked by a club admin.";
  if (status === 409) return "Someone else changed this record. The latest version has been loaded — review it and try again.";
  if (status === 404) return "This item no longer exists or is not part of your team.";
  if (err && typeof err === "object" && "data" in err) {
    const d = (err as { data: unknown }).data as { error?: string; message?: string } | null;
    if (d?.error) return d.error;
    if (d?.message) return d.message;
  }
  return (err as Error)?.message || fallback;
}
