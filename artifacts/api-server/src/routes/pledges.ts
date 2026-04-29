import { Router } from "express";
import { db } from "@workspace/db";
import { fundraisingTable } from "@workspace/db/schema";
import { sendNewPledgeEmail } from "../utils/email";

const router = Router();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/", async (req, res) => {
  const { name, email, amount, note } = req.body ?? {};

  const errors: string[] = [];
  if (typeof name !== "string" || name.trim().length === 0) errors.push("name is required");
  else if (name.trim().length > 200) errors.push("name is too long");

  if (typeof email !== "string" || email.trim().length === 0) errors.push("email is required");
  else if (!isValidEmail(email.trim())) errors.push("email is invalid");
  else if (email.trim().length > 320) errors.push("email is too long");

  const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) errors.push("amount must be a positive number");
  else if (parsedAmount > 10_000_000) errors.push("amount is too large");

  if (note !== undefined && note !== null) {
    if (typeof note !== "string") errors.push("note must be a string");
    else if (note.length > 2000) errors.push("note is too long");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: "Invalid request", details: errors });
    return;
  }

  const cleanName = (name as string).trim();
  const cleanEmail = (email as string).trim();
  const cleanNote = typeof note === "string" ? note.trim() : "";
  const today = new Date().toISOString().slice(0, 10);

  const noteParts: string[] = [`Email: ${cleanEmail}`];
  if (cleanNote) noteParts.push(`Note: ${cleanNote}`);
  const notes = noteParts.join("\n\n");

  const [entry] = await db
    .insert(fundraisingTable)
    .values({
      donorName: cleanName,
      amountPledged: String(parsedAmount),
      amountReceived: "0",
      date: today,
      status: "pending",
      notes,
    })
    .returning();

  sendNewPledgeEmail({
    donorName: cleanName,
    donorEmail: cleanEmail,
    amount: parsedAmount,
    note: cleanNote || undefined,
    pledgeId: entry.id,
  }).catch((err) => console.error("[email] Failed to send pledge notification:", err));

  res.status(201).json({
    id: entry.id,
    donorName: entry.donorName,
    amountPledged: parseFloat(entry.amountPledged ?? "0"),
    status: entry.status,
    createdAt: entry.createdAt?.toISOString(),
  });
});

export default router;
