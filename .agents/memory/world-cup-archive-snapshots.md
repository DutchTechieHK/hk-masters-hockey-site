---
name: World Cup archive snapshots
description: Rules for preserving campaign records while member profiles continue changing.
---

World Cup-only modules are read-only at the API boundary. Hiding controls in the management interface is an additional safeguard, not the archive's integrity control.

**Why:** Member profiles remain active after the campaign, but travel, identity-document, accommodation, insurance, and kit fields on those profiles formed part of the World Cup record. Serving those live fields would silently rewrite history whenever a member updates their current profile.

**How to apply:** Serve archived member information from an immutable campaign snapshot, while sourcing team assignment, participation, fees, and payments from the Rotterdam season-owned records. New reusable content must declare its operational scope explicitly.