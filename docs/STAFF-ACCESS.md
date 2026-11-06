# Team staff access

## For club administrators

1. Sign in at `/admin/` with the existing full-admin password.
2. Open **Staff Access**.
3. Select an existing active member/staff record and a current non-internal team.
4. Choose **Coach** or **Manager** as a descriptive label. Every grant includes view access; enable **Attendance** and/or **Schedule** only where needed.
5. Save. Repeat for additional teams; permissions can differ by team.

The person signs in through **Coach / manager** using their unique member email and the normal six-digit email code. Do not share the full-admin password or API key. Staff need an active member record but do not need a playing participation or World Cup history.

Use **Edit**, **Revoke**, or **Re-enable** on individual grants. Grants belong to the current membership season and do not roll over automatically. Revocation and permission changes are checked on the next protected request; the workspace also refreshes access on focus and every minute. Inactive members, ambiguous emails, expired sessions and ambiguous/expired membership seasons fail closed.

The access screen includes the most recent 100 access/staff action records. Pending outcomes mean an attempt was recorded but did not complete with a recorded HTTP result; they must not be interpreted as successful delivery.

## First-version boundaries

- **View:** operational roster and attendance, without contact details, financial records, private documents, login tokens or full member profiles.
- **Attendance:** correct current squad replies with concurrency protection and remind eligible nonresponders. Reasons are required for Maybe/Not going.
- **Schedule:** create/edit local fixtures and private events exclusively owned by the assigned team. No destructive deletion, public visibility, group/multi-team audiences, photo uploads or automatic new-event notifications.
- Staff cannot select/move squad members or administer groups, archived tournaments, membership, general announcements, website content or access grants.
- Coach/Manager labels, ordinary squad membership and Notion do not confer permissions.
- Failed or uncertain reminder deliveries are not blindly resent. Existing match reminder reconciliation remains full-admin only; staff event reminders retain a pending/uncertain exact-event delivery ledger for full-admin investigation.

## Publishing and verification

Development schema changes have been applied locally. Replit **Republish** must apply the additive production schema diff and deploy the API/admin code. It adds `staff_team_grants`, `staff_sessions`, `staff_audit`, and an `event_rsvps.revision` column. It does not replace full-admin sessions or change existing grants (there were no prior staff grants).

The public/player service worker also excludes staff/auth endpoints from offline caches and purges old entries. Replit Publish updates this safeguard for the player PWA; the usual GitHub/Netlify build updates the same service-worker source on the separate public website. See `ARCHITECTURE.md`.

Permission coverage is in the staff API integration tests; those tests create and remove only tagged development fixtures and mock external email/push delivery. No production permissions or data should be seeded by the implementation.
