# Competition shirt numbers

## Managing numbers

Open **Members → Edit member → Shirt Numbers** as a full administrator.

- **Assign** creates a current number for one competition and team.
- **Change** closes the selected current assignment and creates its replacement in the same competition/team. An optional effective start date also ends the previous assignment on that date. Leave it blank if unknown; the application does not invent a historical date.
- **End** makes an assignment historical, with an optional known end date.
- **Past** records a known older number without replacing a current assignment.
- **Correct** fixes a number, dates or notes; a reason is required. If its team or competition was wrong, void it and add the correct entry.
- **Void** keeps an erroneous record visible in the audit/history instead of deleting it. A reason is required.

Each record retains its actual recorded time separately from optional effective dates. Competition and team labels are retained even when their season ends or the team is renamed. Another person's use of the same number in the same competition/team produces a warning, not a club-wide reservation.

Create a named **League** or **Tournament** context when necessary. For the live league, link its context to **2026/27 Membership** so current league roster/attendance readers can resolve it. A season can have one context of each kind; event seasons use Tournament and membership seasons use League. Custom competitions without an existing season can be named without linking one.

The same person can have different current numbers in different competition/team contexts. Assignment changes are protected by a member-history revision: if another admin saves first, the draft is retained and requires explicit reload/review.

## Existing and archived information

The old single number is retained as **Legacy, context unknown** until an administrator confirms its context with **Attach** or dismisses it with a reason. It is not automatically assumed to be the current league number. Consequently, operational league number badges can be blank until the legacy number has been confirmed for that competition/team.

Rotterdam campaign snapshots are immutable. They remain the source for archived tournament, travel, kit and fundraising views. A member's history can show read-only evidence from that snapshot; assigning or correcting a separate number record does not rewrite the archive. Neither Notion nor current squad membership reconstructs past number assignments.

Current member lists and player details show labelled current assignments plus any unresolved legacy number. Full history, admin notes, correction reasons and audit are full-admin-only. Coach/manager views receive only the relevant number through their existing team access; players cannot edit numbers.

## Publishing

Development schema changes are applied locally. **Republish** must deploy the API/admin code and apply the additive production schema diff: `shirt_contexts`, `shirt_assignments`, `shirt_audit`, and the member revision/legacy-resolution columns. No production assignments have been created or guessed.

The matching compatibility SQL is `lib/db/migrations/20261106_shirt_numbers.sql`; it is additive and data-preserving, not a startup migration. Replit's Publish schema diff remains the production migration path.

The separate public website's My Details display also changed. Its usual GitHub → Netlify rebuild is needed to pick up the labelled display on that domain; Replit Publish updates the player PWA/admin/API copies.
