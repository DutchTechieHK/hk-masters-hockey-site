---
name: Membership fee defaults
description: Why category prices are defaults, not a read-time invariant that may overwrite a current fee.
---

Existing nonstandard current-season amounts due must survive reads and section-only bulk edits. Only an actual category change in the bulk editor replaces that amount with the category fee, after explicitly previewing and acknowledging its consequences. Members already in the target category are no-ops, including their existing amounts due.

**Why:** The approved bulk-edit scope separates operational sections from fee categories. A custom due amount is not invalid merely because it differs from the category price; silently normalizing it would turn a harmless section change or reload into an unreviewed financial change.

**How to apply:** Distinguish initial fee defaults, explicit category changes and existing balances in future fee work. Never add general read-time “repairs” that reset every current participation to its category price.
