type MatchForCal = {
  id: number;
  teamName?: string | null;
  teamCategory?: string | null;
  opponent: string;
  kickoffAt: Date;
  venue?: string | null;
  status: "scheduled" | "in_progress" | "final" | "cancelled";
  notes?: string | null;
  ourScore?: number | null;
  theirScore?: number | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
};

const DEFAULT_MATCH_DURATION_MIN = 90;
const CANONICAL_UID_DOMAIN = "hkmastershockey.com";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIcsUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// RFC 5545 line folding: 75 OCTETS (not characters) max, continuation lines
// start with a single space. We fold on UTF-8 byte boundaries so we never
// split a multi-byte character.
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let offset = 0;
  let isFirst = true;
  while (offset < bytes.length) {
    const maxBytes = isFirst ? 75 : 74;
    let end = Math.min(offset + maxBytes, bytes.length);
    // Walk back if we'd land in the middle of a UTF-8 continuation byte
    // (continuation bytes are 0b10xxxxxx, i.e. byte & 0xc0 === 0x80).
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    const slice = bytes.slice(offset, end).toString("utf8");
    chunks.push((isFirst ? "" : " ") + slice);
    offset = end;
    isFirst = false;
  }
  return chunks.join("\r\n");
}

function buildEvent(match: MatchForCal): string {
  const start = match.kickoffAt;
  const end = new Date(start.getTime() + DEFAULT_MATCH_DURATION_MIN * 60 * 1000);
  const teamLabel = match.teamName || match.teamCategory || "HK Masters";
  const summary = `HK ${teamLabel} vs ${match.opponent}`;
  const descriptionParts: string[] = [];
  if (match.notes) descriptionParts.push(match.notes);
  if (match.status === "final" && match.ourScore != null && match.theirScore != null) {
    descriptionParts.push(`Final score: HK ${match.ourScore} – ${match.theirScore} ${match.opponent}`);
  }
  descriptionParts.push("Hong Kong Masters Hockey – Rotterdam 2026 World Masters Cup");
  const description = descriptionParts.join("\n\n");

  // DTSTAMP must be stable per-revision so subscribed clients don't see
  // every event as "modified" on each poll. Prefer updatedAt, fall back to
  // createdAt, fall back to kickoff (last-resort deterministic value).
  const stamp = match.updatedAt ?? match.createdAt ?? match.kickoffAt;

  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:hkm-match-${match.id}@${CANONICAL_UID_DOMAIN}`,
    `DTSTAMP:${toIcsUtc(stamp)}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
  ];
  if (match.venue) lines.push(`LOCATION:${escapeText(match.venue)}`);
  lines.push(match.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED");
  lines.push("END:VEVENT");

  return lines.map(foldLine).join("\r\n");
}

export function buildIcsCalendar(
  matches: MatchForCal[],
  opts: { calendarName: string },
): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HK Masters Hockey//Rotterdam 2026//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
    "X-WR-TIMEZONE:UTC",
  ].map(foldLine);

  const events = matches.map((m) => buildEvent(m));
  const footer = ["END:VCALENDAR"];

  return [...header, ...events, ...footer].join("\r\n") + "\r\n";
}

export function icsFilename(label: string): string {
  const safe = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safe || "hk-masters"}.ics`;
}
