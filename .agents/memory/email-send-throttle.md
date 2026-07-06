---
name: Email send throttle & failure visibility
description: Bulk email loops must pace sends to the provider rate limit and surface failures, not drop them silently.
---

# Bulk email send loops must throttle and report failures

Any loop that sends email via `sendEmail`/`sendRsvpReminderEmail` (api-server `utils/email.ts`, backed by Resend) must pause ~500ms between sends, and the caller must count and report failures.

**Why:** Resend's default plan rate-limits at ~2 requests/sec. A tight loop with no delay gets most sends rejected with HTTP 429; `sendEmail` returns `false` on any error. If the endpoint only reports `sent` and `skippedNoEmail`, those 429 failures are invisible — counted as neither sent nor skipped, just lost. Real incident: an RSVP reminder to 14 non-responders delivered only 4; the other 10 were silently rate-limited. Regular email blasts (Announcements/Players) worked because they surface a `failed` count and/or are paced differently.

**How to apply:**
- Add `await new Promise(r => setTimeout(r, 500))` between sends, guarded so there's no sleep after the last item (`if (i < list.length - 1)`).
- Compute `failed = eligible - sent` and include it in the JSON response.
- Surface `failed` in the UI (toast + button/label), using a destructive variant when `failed > 0`.
- `polls.ts` remind is the reference throttle pattern; the event RSVP remind in `events.ts` now matches it.
- Better long-term fix (not yet done): add retry/backoff for transient 429/5xx inside the shared `sendEmail`.
