---
name: DB schema changes — dev push + Publish diff
description: How Drizzle schema changes and deploy-critical compatibility SQL are handled in this repo.
---

# Automatic schema application points

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

**How to apply:** Keep the Drizzle schema as the source of truth and use
schema → push (dev) → verify → re-publish for normal changes. For a
deploy-critical constraint that existing or fresh environments must enforce
before application logic can rely on it, also include an idempotent,
data-preserving compatibility file in `lib/db/migrations/`; never use that file
as a replacement for the matching Drizzle schema declaration.

**Why for the exception:** Completion validation requires repository-visible
deployment coverage for constraints that protect canonical records. A safe
compatibility migration also documents how to resolve pre-existing duplicates
without rewriting archived references.

**Must NOT do:** Do not add startup-time DDL to the API server and do not put
`db:push` in any deploy/build hook.
See `.local/skills/database/references/database-migrations-on-publish.md`.
