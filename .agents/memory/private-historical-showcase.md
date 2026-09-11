---
name: Private historical showcase
description: Access-control rules for the World Cup 2026 historical showcase.
---

The historical World Cup showcase must require a valid existing HK Masters admin
session before either its UI or its aggregate archive endpoint is available.
Authentication may create a short-lived admin session, but showcase actions must
not change campaign data or send communications.

**Why:** Aggregate records still reveal financial, travel, and document-readiness
information. A Replit preview and robots directives limit visibility or indexing,
but neither protects a reachable API endpoint.

**How to apply:** Any future published or previewed historical presentation must
enforce the gate in both layers: do not mount data-driven pages before session
validation, and put `requireAdminAccess` (or equivalent server-side middleware)
on every archive data route. Keep its response privacy-safe even after access
control is in place.