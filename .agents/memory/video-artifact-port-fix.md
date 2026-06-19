---
name: Video artifact unregistered port fix
description: When createArtifact allocates a port not in .replit [[ports]], the artifact-managed workflow health check fails. Workaround using configureWorkflow without waitForPort.
---

# Video Artifact Unregistered Port Fix

## The Rule

When `createArtifact` allocates a new port for a video artifact but that port does NOT appear in `.replit [[ports]]`, the platform's `restart_workflow` health check will always fail ("didn't open port N") even though Vite binds successfully. Fix by creating a custom `configureWorkflow` without `waitForPort`, embedding `PORT` and `BASE_PATH` directly in the command string.

**Why:** `.replit [[ports]]` controls which ports the external proxy recognizes. The artifact-managed workflow's health check requires the port to be reachable through that proxy. A custom workflow without `waitForPort` skips this check entirely, so it stays in RUNNING state as long as the process is alive.

**How to apply:**

```javascript
await configureWorkflow({
  name: "Admin Tutorial Videos",
  command: "PORT=20234 BASE_PATH=/admin-video-series/ pnpm --filter @workspace/admin-video-series run dev",
  // No waitForPort — bypasses the .replit [[ports]] health check
});
```

- The artifact-managed workflow (`artifacts/<slug>: web`) will show FAILED — that's expected and harmless.
- The custom workflow keeps the server running and the preview routes via `artifact.toml` paths.
- Use the `artifact.toml`'s `PORT` and `BASE_PATH` values from `[services.env]`.
- `validate-recording.sh` and `presentArtifact` work normally.

**Context:** Confirmed working for `admin-video-series` artifact (port 20234, path `/admin-video-series/`). All 5 `.replit [[ports]]` slots were occupied by other services (api-server/8080, mockup-sandbox/8081, hk-masters/20336, hk-masters-web/22203, pwa-install-video/26214).
