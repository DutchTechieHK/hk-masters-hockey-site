---
name: Video artifact port registration
description: createArtifact for video-js type may not register the new port in .replit [[ports]], making the artifact inaccessible externally. Real fix is a port swap with a lower-priority registered artifact.
---

# Video Artifact Unregistered Port Fix

## The Problem

`createArtifact` allocates a new port but does NOT always add it to `.replit [[ports]]`. Without a `[[ports]]` entry the external Replit proxy (canvas iframes, user browser) cannot reach the service — even though the internal `localhost:80` proxy (used by the screenshot tool) can. The artifact-managed workflow shows FAILED because the platform health-check times out waiting for the port to be registered. The cap appears to be 5 `[[ports]]` entries.

**Why:** `.replit [[ports]]` controls which ports the external proxy recognizes. The artifact-managed workflow health check requires the port to be reachable through that proxy.

## The Real Fix — Port Swap

Swap ports with an existing registered artifact that is lower priority:

1. Read both `artifact.toml` files.
2. Write temp `.edit.toml` files swapping `localPort` and `PORT` env var.
3. Call `verifyAndReplaceArtifactToml` for both (can run in parallel).
4. `restart_workflow` the lower-priority artifact first — it releases the registered port (expected to show FAILED; that's acceptable).
5. `restart_workflow` the higher-priority artifact — it claims the registered port and health check passes → RUNNING.

**How to apply:** Any time a new video/artifact workflow shows FAILED due to port health check, and `.replit [[ports]]` has 5 entries, apply this swap with the least-needed running artifact. `pwa-install-video` (port 26214, externalPort 3000) is the designated donor — it can be rebuilt if needed.

## Port Map (2026-06-19)
- 8080 → api-server (required)
- 8081 → mockup-sandbox (required for canvas)
- 20336 → hk-masters main web (required, externalPort 80)
- 22203 → hk-masters-web public site (required)
- 26214 → **pwa-install-video** (donor; sacrificeable — now used by admin-video-series)

## Old Workaround (insufficient)

Custom `configureWorkflow` without `waitForPort` keeps the process alive but only via the internal proxy — canvas iframes and the user's browser (external proxy) still can't see it. Do NOT rely on this alone.

## Stale Custom Workflow

A "Admin Tutorial Videos" custom workflow may still be running on port 20234. It's harmless (serves via internal routing only) but wastes resources. Leave it or reconfigure to a no-op.
