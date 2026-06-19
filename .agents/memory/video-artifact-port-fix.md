---
name: Video/artifact unregistered dev port
description: Why a newly-added artifact's dev workflow can show FAILED even though it works in production, and the only real ways to fix it.
---

# Artifact dev workflow shows FAILED on an unregistered port

## What happens
`.replit [[ports]]` (the dev external-proxy registry) has a small cap (~5 entries). When more artifacts exist than registered ports, the extra artifact's dev workflow gets a `waitForPort` health check on a port that is NOT in `[[ports]]`. The process starts fine and vite binds the port, but the platform's health check can't confirm it through the external proxy, so it reports `DIDNT_OPEN_A_PORT` and marks the workflow FAILED.

**Key:** this is a DEV-ONLY symptom. Production deploys each artifact independently and does NOT use the dev `[[ports]]` map, so the artifact still serves fine in prod (verify with `curl https://<domain>/<base-path>/` → 200).

## What does NOT work
- `restart_workflow` — keeps timing out on the same health check.
- `configureWorkflow` to drop `waitForPort` — **PROHIBITED_ACTION**: artifact-managed workflows cannot be overridden via setRunWorkflow.

## Real fixes (pick one)
- **Remove the redundant artifact** (best when it's orphaned — grep shows nothing links to its base path, or its content is duplicated/inlined elsewhere). Destructive → confirm with the user first.
- **Port swap**: move the registered `localPort`/`PORT` from a lower-priority RUNNING artifact to the failing one by editing both `artifact.toml`s via the artifact skills (not `.replit` directly), then restart the donor first (it goes FAILED, acceptable) then the recipient.

**Why:** only `[[ports]]`-registered ports are reachable by the dev external proxy; the artifact health check requires that reachability.

## How to triage before acting
1. `curl` the prod base path of the failing artifact — if 200, there is no user-facing problem, only dev noise.
2. grep the repo for links to the artifact's base path — if nothing references it, it's orphaned and safe to remove (with user sign-off).
