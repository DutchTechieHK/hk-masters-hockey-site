---
name: Composite TS project references serve stale types
description: After editing lib/db (or another composite-referenced package) schema, tsc --noEmit in a consumer package can report "property does not exist" even though package.json exports point at ./src — until the referenced project's dist declarations are rebuilt.
---

Packages like `lib/db` use TS project references (`composite: true`, `emitDeclarationOnly`) from consumers (e.g. `api-server`'s tsconfig `references`). Even though `package.json` "exports" maps to `./src/index.ts`, `tsc --noEmit` with project references can still resolve types from the referenced project's stale `dist/*.d.ts`.

**Why:** Drizzle schema edits (e.g. adding a column) type-check fine visually but `tsc` throws `Property 'x' does not exist on type ...PgTableWithColumns...` in a consumer package because the consumer is reading old compiled declarations, not the fresh source.

**How to apply:** After editing a schema/type in a composite-referenced lib package, run `npx tsc -b --force` inside that package's directory (e.g. `lib/db`) before typechecking consumers, or the consumer's typecheck will show false-positive missing-property errors.
