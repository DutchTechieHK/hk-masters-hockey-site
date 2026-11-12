import type { LineupPlacement } from "@workspace/api-client-react";
import { applyPlacement, boardKey, MAX_ON_PITCH } from "./lineup-board";

function assert(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }

export function runLineupBoardTests() {
  // Tap placement onto an empty board, clamped to pitch bounds.
  const a = applyPlacement([], 1, "pitch", 120, -4, true);
  assert(a.ok && a.placements.length === 1 && a.placements[0].x === 97 && a.placements[0].y === 3, "placement clamps into the pitch");

  // Moving the same player never duplicates.
  const b = applyPlacement(a.ok ? a.placements : [], 1, "bench", 50, 50, true);
  assert(b.ok && b.placements.length === 1 && b.placements[0].area === "bench" && b.placements[0].x === 0, "move replaces, no duplicates");

  // Unavailable players cannot be newly added, but stale saved ones may still move.
  assert(!applyPlacement([], 2, "pitch", 50, 50, false).ok, "unavailable player rejected");
  const stale: LineupPlacement[] = [{ playerId: 3, area: "bench", x: 0, y: 0 }];
  assert(applyPlacement(stale, 3, "pitch", 50, 50, false).ok, "stale saved player may be repositioned");

  // Max eleven on pitch; an on-pitch player can still move while full.
  const full: LineupPlacement[] = Array.from({ length: MAX_ON_PITCH }, (_, i) => ({ playerId: i + 10, area: "pitch", x: 50, y: 50 }));
  const twelfth = applyPlacement(full, 99, "pitch", 40, 40, true);
  assert(!twelfth.ok && twelfth.reason === "full", "twelfth pitch player rejected");
  assert(applyPlacement(full, 99, "bench", 0, 0, true).ok, "bench accepts when pitch is full");
  assert(applyPlacement(full, 10, "pitch", 20, 20, true).ok, "existing pitch player can move when full");

  // Dirty detection ignores order and bench coordinates, notices formation/position changes.
  const p1: LineupPlacement[] = [{ playerId: 1, area: "pitch", x: 10, y: 10 }, { playerId: 2, area: "bench", x: 0, y: 0 }];
  const p2: LineupPlacement[] = [{ playerId: 2, area: "bench", x: 33, y: 44 }, { playerId: 1, area: "pitch", x: 10, y: 10 }];
  assert(boardKey("4-3-3", p1) === boardKey("4-3-3", p2), "order/bench coords are not dirty");
  assert(boardKey("4-3-3", p1) !== boardKey("3-4-3", p1), "formation change is dirty");
  assert(boardKey("4-3-3", p1) !== boardKey("4-3-3", [{ ...p1[0], x: 12 }, p1[1]]), "moved marker is dirty");

  // Clearing pitch and bench uses the normal dirty/save lifecycle, without changing formation.
  const cleared: LineupPlacement[] = [];
  assert(boardKey("3-4-3", p1) !== boardKey("3-4-3", cleared), "clearing a saved board is unsaved work");
  assert(boardKey("3-4-3", cleared) === boardKey("3-4-3", []), "saved empty board becomes clean");
  assert(p1.length === 2 && p1[1].area === "bench", "clearing does not mutate saved/published placements");
}

runLineupBoardTests();
