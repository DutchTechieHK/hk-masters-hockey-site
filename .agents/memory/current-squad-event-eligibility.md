---
name: Current squad event eligibility
description: Which team assignment controls local event visibility, RSVPs, and admin invite lists.
---

For local-season events, a member's active current-season participation team is
authoritative for event visibility, RSVP authorization, admin response lists,
and reminder recipients. Use the legacy primary team only when the current
participation has no squad assignment.

Stored RSVPs that no longer match a team-scoped event's current audience remain
in the database for audit purposes, but must not appear in current response
lists or attendance totals. All-squad events continue to accept those responses.

**Why:** Admin squad selection intentionally preserves historical primary-team
and Rotterdam data. Using the legacy team for current events made selected squad
members appear correctly in Teams while hiding that squad's events from them.

**How to apply:** Any new current-season feature that targets a squad should
resolve the active participation for the current membership season first. Do not
overwrite or infer from historical primary-team data to make current behavior
work.