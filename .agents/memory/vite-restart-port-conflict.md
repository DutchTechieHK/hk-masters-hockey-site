---
name: Vite restart port conflict
description: A stale Vite child can survive workflow restart and occupy the artifact's assigned port.
---

If a managed Vite workflow restarts but reports that its assigned port is in use and chooses the next one, check which process still holds the assigned port before trusting the new workflow's ready message. A previous instance may still be serving through the proxy.

**Why:** Restarting the admin app left the earlier Vite process listening on its assigned port; the new managed process announced readiness on the next port while the preview continued to use the old one.

**How to apply:** Check the listener with `lsof -nP -iTCP:<port> -sTCP:LISTEN` and inspect its parent command. If it is a stale instance of the same artifact, stop only that old process tree, then restart the managed workflow so it binds to the assigned port. Do not mistake this for a request to reconfigure artifact ports.