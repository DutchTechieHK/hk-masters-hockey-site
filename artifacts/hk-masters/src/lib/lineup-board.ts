import type { LineupPlacement } from "@workspace/api-client-react";

export const MAX_ON_PITCH = 11;

export const clampCoord = (n: number) => Math.round(Math.min(97, Math.max(3, n)) * 10) / 10;

/** Stable comparison key for dirty detection; bench coordinates are irrelevant. */
export const boardKey = (formation: string, placements: LineupPlacement[]) =>
  JSON.stringify([formation, [...placements].sort((a, b) => a.playerId - b.playerId)
    .map((p) => [p.playerId, p.area, p.area === "pitch" ? p.x : 0, p.area === "pitch" ? p.y : 0])]);

export type PlaceResult =
  | { ok: true; placements: LineupPlacement[] }
  | { ok: false; reason: "unavailable" | "full" };

/**
 * Place or move one player. Never duplicates a player, never exceeds eleven on the pitch,
 * and only lets Going/Maybe players be newly added (already-saved stale placements may move).
 */
export function applyPlacement(
  placements: LineupPlacement[], playerId: number, area: "pitch" | "bench", x: number, y: number, canAdd: boolean,
): PlaceResult {
  const existing = placements.find((p) => p.playerId === playerId);
  if (!existing && !canAdd) return { ok: false, reason: "unavailable" };
  const onPitch = placements.filter((p) => p.area === "pitch").length;
  if (area === "pitch" && existing?.area !== "pitch" && onPitch >= MAX_ON_PITCH) return { ok: false, reason: "full" };
  return {
    ok: true,
    placements: [
      ...placements.filter((p) => p.playerId !== playerId),
      { playerId, area, x: area === "pitch" ? clampCoord(x) : 0, y: area === "pitch" ? clampCoord(y) : 0 },
    ],
  };
}
