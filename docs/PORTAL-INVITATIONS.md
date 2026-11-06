# Selective portal invitations

In **Admin → Announcements → Email players**, use **Invite members to the portal**.

1. Search active members and tick the people you want. Nothing is preselected.
2. Leave **Resend to members already invited** off unless you intentionally want to send another invitation.
3. Choose **Preview invitation**. Review every selected name, status and reason, and the standard message.
4. Confirm the eligible recipients and send. Selection is kept, but another send requires another preview.

The template shortcut in the ordinary email composer takes you to this dedicated invitation tool instead of filling a broad email audience.

## Eligibility and delivery

- Active members in any membership category can be selected. Membership and Notion data are not changed.
- Addresses are trimmed and compared without case. Missing, invalid, or shared active-member addresses are skipped because email-code sign-in cannot safely identify one member.
- Successful legacy automatic/manual Trials invitations count as previous invitations.
- The server rechecks the selection at sending time. Changes to member details or invitation history invalidate the preview rather than changing the audience silently.
- Full administrators alone can use this tool. It does not grant team-staff access, change event visibility, create members, or make portal sign-in invitation-only.
- Invitations point to the existing configured public site's `/login` with the recipient email prefilled. No access token or reusable sign-in credential is emailed; members still request a one-time code.

## Timeouts and uncertain delivery

Email History records the names and addresses actually targeted, with Sent, Pending, or Uncertain status. Pending recipients are recorded before provider contact, and sends are paced at 600 ms.

If the HTTP request fails, **Retry same request** uses the original request ID to retrieve the existing batch rather than sending it again. A completed batch can never be sent again through that request ID. Starting a fresh preview is not a workaround for an uncertain recipient: pending and uncertain attempts remain blocked even when resend is enabled.

Provider exceptions or a non-success result do not establish non-delivery. They are conservatively classified as uncertain; interrupted persistence leaves a pending entry. Check the provider and history before any further action. There is intentionally no automatic retry or unblocking action.

## Publishing

Republish the Replit app to deploy the admin and API changes and the additive `email_blasts.delivery_summary` JSON metadata column. The matching Drizzle declaration and an idempotent compatibility migration are included. There is no startup schema change.

No public website/Netlify rebuild is needed for this feature; it links to the existing public sign-in flow, which is unchanged. No production invitations or production data changes are made by development tests.
