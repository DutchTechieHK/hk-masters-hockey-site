---
name: Historical audience backfills
description: How to preserve recipient history for sends that predate audit logging.
---

Historical email-history backfills must use immutable recipient snapshots verified from production records at the original send cutoff. Do not derive historical recipients from the development database or from the current audience state.

**Why:** Development can lack the production event and squad data, while production RSVPs and memberships can change after a send. Either source can produce a plausible but incorrect historical audience.

**How to apply:** For a verified historical batch, preserve the original send timestamp and totals, snapshot only the verified recipients, make inserts idempotent, and keep the migration completely separate from email-sending code.