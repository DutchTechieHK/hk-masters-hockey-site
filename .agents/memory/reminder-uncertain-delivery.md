---
name: Reminder delivery uncertainty
description: How staff-triggered reminder retries handle provider ambiguity.
---

For staff-triggered match reminders, an email attempt with uncertain delivery must not be retried automatically. A failed provider call or interrupted history update does not prove the provider rejected the message. Staff must independently confirm non-delivery before making that recipient eligible again.

**Why:** An email can be accepted just before a timeout, crash, or failed history update. Retrying solely because the last attempt lacks a success record can send duplicates.

**How to apply:** Preserve a durable per-recipient pending state before the provider call. Retry only when non-delivery is definitively established; generic provider errors are ambiguous. Any future backoff or bulk retry feature must respect this distinction.