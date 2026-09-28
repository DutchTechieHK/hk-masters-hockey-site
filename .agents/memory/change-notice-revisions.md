---
name: Change notice revisions
description: How to keep staff-triggered fixture change notices sendable after later edits.
---

If a saved notification preview binds delivery to a fixture snapshot, a later edit
to message content (such as venue, squad, or opponent) must create a replacement
revision even when the cancellation status or kick-off does not change. Retain the
older revision's delivery history rather than overwriting or reusing its key.

**Why:** A strict snapshot check correctly prevents stale emails, but without a
replacement revision, routine corrections can permanently block the notice.
Reusing the old key could also conceal which message a player actually received.

**How to apply:** For other staff-confirmed notices, treat any change to
recipient-affecting or message-bearing fields as a potential new preview.
Keep delivery attempts bound to the exact immutable revision and require fresh
confirmation; do not automatically resend earlier uncertain attempts.