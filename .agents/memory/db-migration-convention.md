---
name: DB schema changes — dev push + Publish diff (NOT hand-written SQL)
description: How a Drizzle schema change reaches the production database in this repo.
---

# Two — and only two — automatic schema application points

1. **Dev:** edit the schema source of truth (`lib/db/src/schema/*.ts`, per
   `lib/db/drizzle.config.ts`) then `pnpm --filter @workspace/db run push`
   (or `push-force`). This updates the **development** DB only.
2. **Prod:** when the user clicks **Publish**, Replit introspects dev vs prod,
   computes a SQL diff, surfaces any rename for confirmation, and applies it to
   the production DB as part of publishing. **Re-publish is the only supported
   way to migrate prod schema.**

**Why:** Dev and prod are separate managed Postgres DBs. The Publish diff is the
mechanism — there is no prod DB URL in the workspace and `executeSql({environment:
"production"})` is read-only (DDL fails by design).

**How to apply / must NOT do:** Do NOT write ad-hoc SQL files in
`lib/db/migrations/` (they are NOT the source of truth and are NOT applied by
push — the repo's existing `add_*.sql` files are legacy noise), do NOT add
startup-time DDL to the api-server entrypoint, and do NOT put `db:push` in any
deploy/build hook. Just edit schema → push (dev) → verify → tell the user to
re-publish (pure column additions need no rename confirmation).
See `.local/skills/database/references/database-migrations-on-publish.md`.
