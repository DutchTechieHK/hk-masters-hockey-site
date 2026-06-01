import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pollsTable, pollOptionsTable, pollVotesTable, playersTable, teamsTable } from "@workspace/db/schema";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";

const router: IRouter = Router();

const VALID_AUDIENCES = ["all", "MO40", "MO50", "both"] as const;
type Audience = typeof VALID_AUDIENCES[number];

const PUBLIC_URL = process.env.PUBLIC_URL || "https://www.hkmastershockey.com";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(opts: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[polls-email] RESEND_API_KEY not set — skipping email to", opts.to);
    return false;
  }
  const emailOverride = process.env.EMAIL_OVERRIDE?.trim() || null;
  const actualTo = emailOverride ?? opts.to;
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const VERIFIED_FROM = "HK Masters Hockey <play@hkmastershockey.com>";
  const FALLBACK_FROM = "HK Masters Hockey <onboarding@resend.dev>";
  let { error } = await resend.emails.send({ from: VERIFIED_FROM, to: actualTo, subject: opts.subject, html: opts.html, text: opts.text });
  if (error && (error as { statusCode?: number }).statusCode === 403) {
    ({ error } = await resend.emails.send({ from: FALLBACK_FROM, to: actualTo, subject: opts.subject, html: opts.html, text: opts.text }));
  }
  if (error) { console.error("[polls-email] Failed:", JSON.stringify(error)); return false; }
  console.log(`[polls-email] Sent to ${actualTo}: "${opts.subject}"`);
  return true;
}

function pollEmailHtml(opts: { playerName: string; pollTitle: string; pollDescription: string | null; deadline: Date | null; voteUrl: string }): { html: string; text: string } {
  const safeName = escapeHtml(opts.playerName);
  const safeTitle = escapeHtml(opts.pollTitle);
  const safeDesc = opts.pollDescription ? `<p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">${escapeHtml(opts.pollDescription)}</p>` : "";
  const deadlineStr = opts.deadline ? `<p style="margin:0 0 16px 0;font-size:14px;color:#6b7280;">Please respond by <strong>${opts.deadline.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong>.</p>` : "";
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background-color:#1E3A6E;padding:24px 32px;text-align:center;">
<img src="https://www.hkmastershockey.com/logo.png" alt="HK Masters Hockey" width="64" height="64" style="display:block;margin:0 auto 14px auto;border-radius:8px;"/>
<p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">HK Masters Hockey</p>
<p style="margin:6px 0 0 0;font-size:13px;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.08em;">2026 Masters World Cup</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px 0;font-size:16px;color:#1f2937;line-height:1.6;">Hi ${safeName},</p>
<p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">You're invited to vote on the following poll:</p>
<h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#1E3A6E;">${safeTitle}</h2>
${safeDesc}${deadlineStr}
<div style="text-align:center;margin:28px 0;">
<a href="${opts.voteUrl}" style="display:inline-block;background-color:#1E3A6E;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 32px;border-radius:8px;">Cast Your Vote →</a>
</div>
<p style="margin:0;font-size:13px;color:#9ca3af;">Or copy this link: <a href="${opts.voteUrl}" style="color:#1E3A6E;">${opts.voteUrl}</a></p>
</td></tr>
<tr><td style="padding:20px 32px 28px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:13px;font-weight:600;color:#1E3A6E;">The HK Masters Hockey Team</p>
<p style="margin:4px 0 0 0;font-size:12px;color:#9ca3af;">HK 2026 Masters World Cup</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
  const text = `Hi ${opts.playerName},\n\nYou're invited to vote on: ${opts.pollTitle}\n${opts.pollDescription ? "\n" + opts.pollDescription + "\n" : ""}${opts.deadline ? "\nPlease respond by " + opts.deadline.toLocaleDateString("en-GB") + ".\n" : ""}\nCast your vote here: ${opts.voteUrl}\n\n— The HK Masters Hockey Team`;
  return { html, text };
}

async function getEligiblePlayers(audience: Audience) {
  const rows = await db
    .select({ player: playersTable, teamCategory: teamsTable.category })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id));
  if (audience === "all" || audience === "both") return rows.map(r => r.player);
  return rows.filter(r => r.teamCategory === audience).map(r => r.player);
}

function serializePoll(poll: typeof pollsTable.$inferSelect) {
  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    audience: poll.audience,
    allowMultiple: poll.allowMultiple,
    deadline: poll.deadline?.toISOString() ?? null,
    closedAt: poll.closedAt?.toISOString() ?? null,
    createdAt: poll.createdAt.toISOString(),
  };
}

function serializeOption(opt: typeof pollOptionsTable.$inferSelect) {
  return { id: opt.id, pollId: opt.pollId, label: opt.label, sortOrder: opt.sortOrder };
}

// ── Admin: list polls ────────────────────────────────────────────────────────

router.get("/", requireAdminAccess, async (req, res) => {
  const polls = await db.select().from(pollsTable).orderBy(pollsTable.id);
  const options = polls.length > 0
    ? await db.select().from(pollOptionsTable).where(inArray(pollOptionsTable.pollId, polls.map(p => p.id))).orderBy(pollOptionsTable.sortOrder)
    : [];
  const voteCounts = polls.length > 0
    ? await db
        .select({ optionId: pollVotesTable.optionId, count: sql<number>`count(*)::int`.as("count") })
        .from(pollVotesTable)
        .where(inArray(pollVotesTable.pollId, polls.map(p => p.id)))
        .groupBy(pollVotesTable.optionId)
    : [];
  const voteCountMap = new Map(voteCounts.map(v => [v.optionId, v.count]));
  const optsByPoll = new Map<number, typeof options>();
  for (const o of options) {
    if (!optsByPoll.has(o.pollId)) optsByPoll.set(o.pollId, []);
    optsByPoll.get(o.pollId)!.push(o);
  }
  res.json(polls.map(p => ({
    ...serializePoll(p),
    options: (optsByPoll.get(p.id) ?? []).map(o => ({
      ...serializeOption(o),
      voteCount: voteCountMap.get(o.id) ?? 0,
    })),
  })));
});

// ── Admin: create poll ───────────────────────────────────────────────────────

router.post("/", requireAdminAccess, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title required" });
  const description = typeof b.description === "string" ? b.description.trim() || null : null;
  const audience = VALID_AUDIENCES.includes(b.audience as Audience) ? (b.audience as Audience) : "all";
  const allowMultiple = b.allowMultiple === true || b.allowMultiple === "true";
  let deadline: Date | null = null;
  if (b.deadline && typeof b.deadline === "string") {
    const d = new Date(b.deadline);
    if (!isNaN(d.getTime())) deadline = d;
  }
  const rawOptions = Array.isArray(b.options) ? b.options as string[] : [];
  const labels = rawOptions.map((l: unknown) => typeof l === "string" ? l.trim() : "").filter(Boolean);
  if (labels.length < 2) return res.status(400).json({ error: "At least 2 options required" });
  if (labels.length > 5) return res.status(400).json({ error: "Maximum 5 options allowed" });
  const [poll] = await db.insert(pollsTable).values({ title, description, audience, allowMultiple, deadline }).returning();
  const opts = await db.insert(pollOptionsTable).values(labels.map((label, i) => ({ pollId: poll.id, label, sortOrder: i }))).returning();
  res.status(201).json({ ...serializePoll(poll), options: opts.map(o => ({ ...serializeOption(o), voteCount: 0 })) });
});

// ── Admin: get poll detail (results + voters + non-responders) ───────────────

router.get("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, id));
  if (!poll) return res.status(404).json({ error: "Not found" });
  const options = await db.select().from(pollOptionsTable).where(eq(pollOptionsTable.pollId, id)).orderBy(pollOptionsTable.sortOrder);
  const votes = await db
    .select({ vote: pollVotesTable, playerName: playersTable.name, playerEmail: playersTable.email })
    .from(pollVotesTable)
    .leftJoin(playersTable, eq(pollVotesTable.playerId, playersTable.id))
    .where(eq(pollVotesTable.pollId, id));
  const eligible = await getEligiblePlayers(poll.audience as Audience);
  const voterIds = new Set(votes.map(v => v.vote.playerId));
  const nonResponders = eligible.filter(p => !voterIds.has(p.id));
  const votesByOption = new Map<number, { playerName: string; playerEmail: string }[]>();
  for (const v of votes) {
    if (!votesByOption.has(v.vote.optionId)) votesByOption.set(v.vote.optionId, []);
    votesByOption.get(v.vote.optionId)!.push({ playerName: v.playerName ?? "Unknown", playerEmail: v.playerEmail ?? "" });
  }
  res.json({
    ...serializePoll(poll),
    options: options.map(o => ({
      ...serializeOption(o),
      voteCount: (votesByOption.get(o.id) ?? []).length,
      voters: votesByOption.get(o.id) ?? [],
    })),
    totalEligible: eligible.length,
    totalVoted: voterIds.size,
    nonResponders: nonResponders.map(p => ({ id: p.id, name: p.name, email: p.email, accessToken: p.accessToken })),
  });
});

// ── Admin: edit poll ─────────────────────────────────────────────────────────

router.patch("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, id));
  if (!poll) return res.status(404).json({ error: "Not found" });

  const b = req.body as Record<string, unknown>;

  const updates: Partial<typeof pollsTable.$inferInsert> = {};
  if (typeof b.title === "string") {
    const title = b.title.trim();
    if (!title) return res.status(400).json({ error: "title required" });
    updates.title = title;
  }
  if ("description" in b) {
    updates.description = typeof b.description === "string" ? b.description.trim() || null : null;
  }
  if (typeof b.audience === "string" && VALID_AUDIENCES.includes(b.audience as Audience)) {
    updates.audience = b.audience as Audience;
  }
  if ("deadline" in b) {
    if (b.deadline && typeof b.deadline === "string") {
      const d = new Date(b.deadline);
      updates.deadline = isNaN(d.getTime()) ? null : d;
    } else {
      updates.deadline = null;
    }
  }

  // Check if any votes exist — if not, allow option edits too
  const [voteCheck] = await db
    .select({ count: sql<number>`count(*)::int`.as("count") })
    .from(pollVotesTable)
    .where(eq(pollVotesTable.pollId, id));
  const hasVotes = (voteCheck?.count ?? 0) > 0;

  if (Array.isArray(b.options) && !hasVotes) {
    const rawOptions = b.options as unknown[];
    const labels = rawOptions.map((l) => (typeof l === "string" ? l.trim() : "")).filter(Boolean);
    if (labels.length < 2) return res.status(400).json({ error: "At least 2 options required" });
    if (labels.length > 5) return res.status(400).json({ error: "Maximum 5 options allowed" });
    await db.delete(pollOptionsTable).where(eq(pollOptionsTable.pollId, id));
    await db.insert(pollOptionsTable).values(labels.map((label, i) => ({ pollId: id, label, sortOrder: i })));
  } else if (Array.isArray(b.options) && hasVotes) {
    return res.status(400).json({ error: "Options cannot be changed once votes have been cast" });
  }

  const [updated] = Object.keys(updates).length > 0
    ? await db.update(pollsTable).set(updates).where(eq(pollsTable.id, id)).returning()
    : [poll];

  const options = await db.select().from(pollOptionsTable).where(eq(pollOptionsTable.pollId, id)).orderBy(pollOptionsTable.sortOrder);
  const voteCounts = await db
    .select({ optionId: pollVotesTable.optionId, count: sql<number>`count(*)::int`.as("count") })
    .from(pollVotesTable)
    .where(eq(pollVotesTable.pollId, id))
    .groupBy(pollVotesTable.optionId);
  const countMap = new Map(voteCounts.map(v => [v.optionId, v.count]));

  res.json({
    ...serializePoll(updated),
    options: options.map(o => ({ ...serializeOption(o), voteCount: countMap.get(o.id) ?? 0 })),
  });
});

// ── Admin: close / reopen poll ───────────────────────────────────────────────

router.patch("/:id/close", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, id));
  if (!poll) return res.status(404).json({ error: "Not found" });
  const closing = !poll.closedAt;
  const [updated] = await db.update(pollsTable).set({ closedAt: closing ? new Date() : null }).where(eq(pollsTable.id, id)).returning();
  res.json(serializePoll(updated));
});

// ── Admin: delete poll ───────────────────────────────────────────────────────

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  await db.delete(pollsTable).where(eq(pollsTable.id, id));
  res.status(204).send();
});

// ── Admin: email blast poll to eligible players ──────────────────────────────

router.post("/:id/email", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, id));
  if (!poll) return res.status(404).json({ error: "Not found" });
  const eligible = await getEligiblePlayers(poll.audience as Audience);
  const playersWithToken = eligible.filter(p => p.accessToken && p.email);
  let sent = 0; let failed = 0;
  for (const player of playersWithToken) {
    const voteUrl = `${PUBLIC_URL}/polls/${id}?t=${player.accessToken}`;
    const { html, text } = pollEmailHtml({ playerName: player.name, pollTitle: poll.title, pollDescription: poll.description, deadline: poll.deadline, voteUrl });
    const ok = await sendEmail({ to: player.email, subject: `Vote: ${poll.title}`, html, text });
    if (ok) sent++; else failed++;
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`[polls] Email blast for poll ${id}: sent=${sent} failed=${failed}`);
  res.json({ sent, failed, total: playersWithToken.length });
});

// ── Admin: remind non-responders ─────────────────────────────────────────────

router.post("/:id/remind", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, id));
  if (!poll) return res.status(404).json({ error: "Not found" });
  const eligible = await getEligiblePlayers(poll.audience as Audience);
  const votes = await db.select({ playerId: pollVotesTable.playerId }).from(pollVotesTable).where(eq(pollVotesTable.pollId, id));
  const voterIds = new Set(votes.map(v => v.playerId));
  const nonResponders = eligible.filter(p => !voterIds.has(p.id) && p.accessToken && p.email);
  let sent = 0; let failed = 0;
  for (const player of nonResponders) {
    const voteUrl = `${PUBLIC_URL}/polls/${id}?t=${player.accessToken}`;
    const { html, text } = pollEmailHtml({ playerName: player.name, pollTitle: poll.title, pollDescription: poll.description, deadline: poll.deadline, voteUrl });
    const ok = await sendEmail({ to: player.email, subject: `Reminder: Vote on ${poll.title}`, html, text });
    if (ok) sent++; else failed++;
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`[polls] Remind non-responders for poll ${id}: sent=${sent} failed=${failed}`);
  res.json({ sent, failed, total: nonResponders.length });
});

// ── Public: get poll for voting ──────────────────────────────────────────────

router.get("/vote/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const token = typeof req.query.t === "string" ? req.query.t.trim() : null;
  let player: typeof playersTable.$inferSelect | null = null;
  if (token && token.length >= 8) {
    const rows = await db.select().from(playersTable).where(eq(playersTable.accessToken, token));
    player = rows[0] ?? null;
  }
  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, id));
  if (!poll) return res.status(404).json({ error: "Poll not found" });
  const options = await db.select().from(pollOptionsTable).where(eq(pollOptionsTable.pollId, id)).orderBy(pollOptionsTable.sortOrder);
  const voteCounts = await db
    .select({ optionId: pollVotesTable.optionId, count: sql<number>`count(*)::int`.as("count") })
    .from(pollVotesTable)
    .where(eq(pollVotesTable.pollId, id))
    .groupBy(pollVotesTable.optionId);
  const countMap = new Map(voteCounts.map(v => [v.optionId, v.count]));
  let myVotedOptionIds: number[] = [];
  if (player) {
    const myVotes = await db.select().from(pollVotesTable).where(and(eq(pollVotesTable.pollId, id), eq(pollVotesTable.playerId, player.id)));
    myVotedOptionIds = myVotes.map(v => v.optionId);
  }
  res.json({
    ...serializePoll(poll),
    options: options.map(o => ({
      ...serializeOption(o),
      voteCount: countMap.get(o.id) ?? 0,
      voted: myVotedOptionIds.includes(o.id),
    })),
    playerName: player?.name ?? null,
    hasVoted: myVotedOptionIds.length > 0,
    totalVotes: countMap.size > 0 ? Array.from(countMap.values()).reduce((a, b) => a + b, 0) : 0,
  });
});

// ── Public: submit vote ──────────────────────────────────────────────────────

router.post("/vote/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const token = typeof req.query.t === "string" ? req.query.t.trim() : null;
  if (!token || token.length < 8) return res.status(401).json({ error: "Access token required" });
  const [player] = await db.select().from(playersTable).where(eq(playersTable.accessToken, token));
  if (!player) return res.status(401).json({ error: "Invalid access token" });
  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, id));
  if (!poll) return res.status(404).json({ error: "Poll not found" });
  if (poll.closedAt) return res.status(400).json({ error: "This poll is closed" });
  if (poll.deadline && new Date() > poll.deadline) return res.status(400).json({ error: "The deadline for this poll has passed" });
  // Enforce audience membership
  if (poll.audience !== "all") {
    const [teamRow] = await db.select({ category: teamsTable.category }).from(teamsTable).where(eq(teamsTable.id, player.teamId));
    const category = teamRow?.category ?? null;
    const allowed = poll.audience === "both"
      ? (category === "MO40" || category === "MO50")
      : category === poll.audience;
    if (!allowed) return res.status(403).json({ error: "You are not in the audience for this poll" });
  }
  const rawOptionIds: number[] = Array.isArray(req.body?.optionIds)
    ? (req.body.optionIds as unknown[]).map(Number).filter(n => Number.isFinite(n) && n > 0)
    : typeof req.body?.optionId === "number" ? [req.body.optionId]
    : [];
  if (rawOptionIds.length === 0) return res.status(400).json({ error: "No option selected" });
  if (!poll.allowMultiple && rawOptionIds.length > 1) return res.status(400).json({ error: "This poll only allows one choice" });
  const options = await db.select().from(pollOptionsTable).where(eq(pollOptionsTable.pollId, id));
  const validIds = new Set(options.map(o => o.id));
  if (!rawOptionIds.every(oid => validIds.has(oid))) return res.status(400).json({ error: "Invalid option" });
  const existingVotes = await db.select().from(pollVotesTable).where(and(eq(pollVotesTable.pollId, id), eq(pollVotesTable.playerId, player.id)));
  if (existingVotes.length > 0) {
    await db.delete(pollVotesTable).where(and(eq(pollVotesTable.pollId, id), eq(pollVotesTable.playerId, player.id)));
  }
  await db.insert(pollVotesTable).values(rawOptionIds.map(optionId => ({ pollId: id, optionId, playerId: player.id })));
  const voteCounts = await db
    .select({ optionId: pollVotesTable.optionId, count: sql<number>`count(*)::int`.as("count") })
    .from(pollVotesTable)
    .where(eq(pollVotesTable.pollId, id))
    .groupBy(pollVotesTable.optionId);
  const countMap = new Map(voteCounts.map(v => [v.optionId, v.count]));
  res.json({
    ...serializePoll(poll),
    options: options.map(o => ({
      ...serializeOption(o),
      voteCount: countMap.get(o.id) ?? 0,
      voted: rawOptionIds.includes(o.id),
    })),
    hasVoted: true,
    playerName: player.name,
  });
});

export default router;
