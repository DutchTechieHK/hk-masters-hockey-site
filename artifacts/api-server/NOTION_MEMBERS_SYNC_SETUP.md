# Notion Members Sync

The API imports responses from the external Notion join form into the Members list.

## Required configuration

- `NOTION_API_TOKEN` — secret for a Notion internal integration. Add the integration to the join responses database through Notion's **Connections** menu.
- `NOTION_MEMBERS_DATABASE_ID` — non-secret database or data-source ID for the join responses.
- `NOTION_MEMBERS_SYNC_CRON` — optional cron expression. The default is every 15 minutes: `*/15 * * * *`.

Use the same values in development and production unless separate Notion databases are intentionally maintained. Replit Publish applies the database schema additions in production.

## Form properties

The current importer expects these Notion properties:

- `First Name` (title)
- `Last Name` (rich text)
- `Email` (email)
- `WhatsApp / Phone` (phone)
- `Submitted` (created time)
- `Consent to Be Contacted` (checkbox)

Other form properties are retained in the submission audit data only when consent is granted.

## Behavior

- The Notion page ID is the idempotency key.
- New valid applicants become active members in the internal **Awaiting Selection** holding team.
- Existing normalized-email matches are linked without changing an already selected membership tier.
- Duplicate emails, changed identity details, malformed rows, and missing consent require review.
- Withdrawing consent makes a Notion-created applicant inactive and removes PII from the submission audit row.
- A PostgreSQL advisory lock prevents scheduled and manual syncs from overlapping across server instances.
- The server runs one sync shortly after startup and then follows the cron schedule.

Admins can inspect the latest run and trigger an immediate retry from **Members → Membership interest reconciliation**.