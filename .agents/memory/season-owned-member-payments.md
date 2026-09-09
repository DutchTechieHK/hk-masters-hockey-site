---
name: Season-owned member payments
description: Membership payment ledgers must remain isolated by season during and after the Rotterdam-to-members migration.
---

Every member payment row must have a season owner. Legacy ledger rows belong to the archived Rotterdam 2026 event; they must never be treated as payment toward the current membership season.

**Why:** Member identity is permanent across events, while payment obligations are seasonal. Reusing an identity-level balance would make old tournament payments incorrectly satisfy a new membership fee.

**How to apply:** Any new membership billing or reporting must filter and aggregate by season. Keep the legacy flattened fee fields as Rotterdam compatibility fields until all old consumers are migrated.