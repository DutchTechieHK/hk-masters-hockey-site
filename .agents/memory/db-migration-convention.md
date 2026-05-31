---
name: DB schema change convention (dev push + prod SQL file)
description: How to ship a Drizzle schema change so BOTH dev and production get it.
---

# Shipping a schema change requires TWO steps

`drizzle-kit push` (`pnpm --filter @workspace/db run push`) updates the **dev**
database only. There is no `generate`/`migrate` script and no prod DB URL in the
workspace.

Production schema changes are applied from **hand-written idempotent SQL files**
in `lib/db/migrations/` (e.g. `add_fundraising_paid_at.sql`). Pattern:

```sql
ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type> [NOT NULL DEFAULT ...];
```

**Why:** Editing `lib/db/src/schema/*.ts` + push only touches dev. If you skip the
SQL file, the deployed app (which expects the new column) breaks against the prod
DB with "column does not exist". A code review flagged exactly this omission.

**How to apply:** For any schema edit — (1) edit the schema TS, (2) `run push`
for dev, (3) add a matching idempotent `ALTER TABLE ... IF NOT EXISTS` file in
`lib/db/migrations/`, (4) the prod ALTER + api-server redeploy is a separate
release step the user/deploy performs.
