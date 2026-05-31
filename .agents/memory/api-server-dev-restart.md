---
name: api-server dev needs restart
description: The api-server dev workflow does not hot-reload; edits require a manual workflow restart.
---

The `artifacts/api-server` dev workflow runs `tsx ./src/index.ts` (no `--watch`).

**Rule:** After editing any api-server source, restart the `artifacts/api-server: API Server` workflow before testing — the running process keeps serving the old code otherwise.

**Why:** Unlike the Vite frontends (which HMR), the API has no file watcher, so changes silently do nothing until restart. This caused confusion where a new endpoint 404'd / old behavior persisted after editing.

**How to apply:** Use `restart_workflow("artifacts/api-server: API Server")` after API edits, then verify via `curl http://localhost:8080/...` or the dev domain.
