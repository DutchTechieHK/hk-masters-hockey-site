import { z } from "zod"
import { zoneInputToIso } from "./timezone"

const score = z.union([
  z.literal(""),
  z.coerce.number().int().min(0),
]).optional()

export const matchSchema = z.object({
  teamId: z.coerce.number().int().min(1, "Team is required"),
  opponent: z.string().min(1, "Opponent is required"),
  kickoffAt: z.string().min(1, "Date and time required"),
  venue: z.string().optional(),
  status: z.enum(["scheduled", "in_progress", "final", "cancelled"]),
  ourScore: score,
  theirScore: score,
  notes: z.string().optional(),
})

export type MatchFormValues = z.infer<typeof matchSchema>

export function buildMatchPayload(data: MatchFormValues, tz: string) {
  return {
    teamId: data.teamId,
    opponent: data.opponent,
    kickoffAt: zoneInputToIso(data.kickoffAt, tz),
    venue: data.venue || undefined,
    status: data.status,
    ourScore: data.ourScore === "" || data.ourScore == null ? null : data.ourScore,
    theirScore: data.theirScore === "" || data.theirScore == null ? null : data.theirScore,
    notes: data.notes || undefined,
  }
}

export function getMatchStatusError(payload: ReturnType<typeof buildMatchPayload>): string | null {
  if ((payload.status === "in_progress" || payload.status === "final") && new Date(payload.kickoffAt) > new Date()) {
    return "Leave it Scheduled until kick-off before marking it Live or Final."
  }
  if (payload.status === "final" && (payload.ourScore === null || payload.theirScore === null)) {
    return "Enter both scores before marking a match Final."
  }
  return null
}