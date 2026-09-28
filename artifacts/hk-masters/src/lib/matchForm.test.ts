import assert from "node:assert/strict"
import { test } from "node:test"
import { buildMatchPayload, getMatchStatusError, matchSchema } from "./matchForm"

const base = {
  teamId: "1",
  opponent: "Test opposition",
  kickoffAt: "2020-10-10T18:00",
  status: "scheduled",
  ourScore: "",
  theirScore: "",
}

test("blank scores stay absent when an unscored match is marked Live", () => {
  const parsed = matchSchema.parse({ ...base, status: "in_progress" })
  const payload = buildMatchPayload(parsed, "Asia/Hong_Kong")
  assert.equal(payload.ourScore, null)
  assert.equal(payload.theirScore, null)
  assert.equal(getMatchStatusError(payload), null)
})

test("Final requires both scores explicitly, but accepts a real 0–0", () => {
  const blank = buildMatchPayload(matchSchema.parse({ ...base, status: "final" }), "Asia/Hong_Kong")
  assert.match(getMatchStatusError(blank) ?? "", /both scores/)
  const oneScore = buildMatchPayload(matchSchema.parse({ ...base, status: "final", ourScore: "2" }), "Asia/Hong_Kong")
  assert.match(getMatchStatusError(oneScore) ?? "", /both scores/)
  const draw = buildMatchPayload(matchSchema.parse({ ...base, status: "final", ourScore: "0", theirScore: "0" }), "Asia/Hong_Kong")
  assert.deepEqual([draw.ourScore, draw.theirScore], [0, 0])
  assert.equal(getMatchStatusError(draw), null)
})

test("future fixtures cannot be saved as Live or Final, even with scores", () => {
  for (const status of ["in_progress", "final"]) {
    const payload = buildMatchPayload(matchSchema.parse({
      ...base, kickoffAt: "2030-10-10T18:00", status, ourScore: "1", theirScore: "0",
    }), "Asia/Hong_Kong")
    assert.match(getMatchStatusError(payload) ?? "", /until kick-off/)
  }
})