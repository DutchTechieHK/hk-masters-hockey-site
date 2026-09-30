---
name: Notion conflict truth
description: The user's intended semantics for resolving app-versus-Notion member profile mismatches.
---

When a Notion member sync finds conflicting profile values, admins choose the authoritative source for each mismatched field. Saving must actually apply selected Notion values and persist app-value choices so a later sync does not silently undo the decision.

**Why:** Merely matching a submission while keeping existing values, or dismissing it, does not resolve which value is correct. The user explicitly corrected this distinction.

**How to apply:** Show both values, require a deliberate choice for every conflict, reject saves based on stale values, and preserve the chosen authority in subsequent Notion syncs. Changed Notion email identities still need explicit review.