---
name: LEGO Jar amount model & prod data writes
description: How LEGO jar bet amounts are stored (single-item model) and how to correct live guess data.
---

# LEGO Jar bet amounts — single-item model

Each guess is a row in `lego_jar_guesses` with its own `amount_paid`. A "bet" of N guesses shares a guesser name. Store the **full bet amount on the first (lowest-id) row and 0 on the rest** — never split the amount across rows.

**Why:** Splitting (e.g. $100 / 3 = 33.33 ×3) produced 99.99 sums and, after a buggy integer edit, 33+33+33 = 99. Both showed as wrong totals. Whole-number amounts on one row make `SUM(amount_paid)` exact with no rounding. Pricing tiers: 1 guess = $50, 3 guesses = $100 (discount bundle), so a 3-guess paid group should total $100, a 6-guess group $200.

**How to apply:** Both create endpoints (public + admin) and the admin edit-modal save use this rule. Display code still `Math.round()`s sums as a harmless safety net. If you ever reintroduce per-guess amounts, keep them whole or the rounding bug returns.

# Correcting live guess data

The **dev database is empty** — all real LEGO jar / fundraising data lives in **production**. `executeSql({environment:"production"})` is **read-only** (writes roll back).

To write production data, call the **deployed admin API** at `https://masters-world-hub.replit.app/api/...` with header `x-admin-key: $ADMIN_API_KEY` (env var present in the workspace shell; do not print it). The PATCH endpoint `/api/admin/lego-jar/guesses/:id` accepts `amountPaid` and stores it as-is, independent of whatever code version is deployed.

**Why:** There is no `PROD_DATABASE_URL` and no psql access to prod; the authenticated deployed API is the only write path. `process.env` is NOT exposed in the code_execution sandbox, so use bash/curl where `$ADMIN_API_KEY` is available.

# Payment verification & Website designation

A guess counts as **active participation only when paid** (verified). Public
`/stats` counts paid guesses only (`COUNT(*) FILTER (WHERE paid)`); `paid_at` is
stamped when an admin toggles paid. Manual admin entries default to PENDING.

Online website submissions attach to a **permanent special round** with
`is_website=true` (holderName "Website", never closed), via `getWebsiteRound()`
(find-or-create). `getCurrentRound()` excludes website rounds, so the Website
round is never the "current holder". The Website round is excluded from the
public holder journey (`rounds` list) but its **paid** guesses still count in the
global `totalRaised`/`totalGuesses`. Admin "Move to Website" reassigns a
guesser's guesses by PATCHing `roundId`.

**Why:** Online buyers shouldn't be credited to whoever physically holds the jar.
Keep website attribution out of holder stats but inside fundraising totals.
