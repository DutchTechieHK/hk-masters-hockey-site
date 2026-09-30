---
name: Passport review concurrency
description: Why admin passport-copy changes require optimistic concurrency against self-service uploads.
---

Admin passport-copy review and replacement must conditionally update the record only if its copy URL and review state still match what the admin saw. Narrow document updates should not resend name, team, or email.

**Why:** A player can upload a new passport copy through the portal while an admin has the old copy open. A stale admin save must not approve a new, unseen copy or replace the newer upload; resending stale identity fields can also undo unrelated profile edits.

**How to apply:** Use the conditional admin document-update contract for future passport UI flows. On conflict, refresh the current record and require the admin to review it again.