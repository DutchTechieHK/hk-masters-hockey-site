const ADMIN_EMAIL = "play@hkmastershockey.com";
const VERIFIED_FROM = "HK Masters Hockey <play@hkmastershockey.com>";
const FALLBACK_FROM = "HK Masters Hockey <onboarding@resend.dev>";

const EMAIL_OVERRIDE = process.env.EMAIL_OVERRIDE?.trim() || null;

const ADMIN_APP_URL =
  process.env.ADMIN_APP_URL || "https://masters-world-hub.replit.app";
const PUBLIC_URL =
  process.env.PUBLIC_URL || "https://www.hkmastershockey.com";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", opts.to);
    return false;
  }

  const actualTo = EMAIL_OVERRIDE ?? opts.to;
  if (EMAIL_OVERRIDE) {
    console.warn(`[email] EMAIL_OVERRIDE active — redirecting email from ${opts.to} to ${EMAIL_OVERRIDE}`);
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  let { error } = await resend.emails.send({
    from: VERIFIED_FROM,
    to: actualTo,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error && (error as { statusCode?: number }).statusCode === 403) {
    console.warn("[email] Custom domain not yet verified — retrying with fallback sender");
    ({ error } = await resend.emails.send({
      from: FALLBACK_FROM,
      to: actualTo,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }));
  }

  if (error) {
    console.error("[email] Failed to deliver to", actualTo, "—", JSON.stringify(error));
    return false;
  } else {
    console.log(`[email] Sent to ${actualTo}: "${opts.subject}"`);
    return true;
  }
}

const LOGO_URL = "https://www.hkmastershockey.com/logo.png";

function emailShell(headerBg: string, title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:${headerBg};padding:24px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="HK Masters Hockey" width="64" height="64" style="display:block;margin:0 auto 14px auto;border-radius:8px;" />
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">HK Masters Hockey</p>
            <p style="margin:6px 0 0 0;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:0.08em;text-transform:uppercase;">2026 World Masters Championship</p>
          </td>
        </tr>
        <tr><td style="padding:32px;">
          ${body}
        </td></tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;border-top:1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <p style="margin:0;font-size:13px;font-weight:600;color:#006B3C;">The HK Masters Hockey Team</p>
                <p style="margin:4px 0 0 0;font-size:12px;color:#9ca3af;">HK 2026 Masters World Cup</p>
              </td>
              <td align="right">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#006B3C;margin-right:2px;"></span>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#DE2910;"></span>
              </td>
            </tr></table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendContributionConfirmationEmail(opts: {
  authorName: string;
  authorEmail: string;
  title: string;
  contentType: string;
  contributionId: number;
}) {
  const typeLabel =
    opts.contentType === "article"
      ? "article"
      : opts.contentType === "photo"
        ? "photo submission"
        : "article and photos";

  const statusUrl = `${PUBLIC_URL}/my-submission`;
  const safeName = escapeHtml(opts.authorName);
  const safeTitle = escapeHtml(opts.title);

  const html = emailShell(
    "#006B3C",
    "Submission received",
    `<p style="margin:0 0 16px 0;font-size:16px;color:#1f2937;line-height:1.6;">Hi ${safeName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      Thank you for submitting your ${typeLabel} to the <strong>HK Masters Hockey Journal</strong>!
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      We've received your submission <strong>&ldquo;${safeTitle}&rdquo;</strong> and it is now under review. We'll send you another email once it has been approved or declined.
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#374151;line-height:1.7;">
      You can check the status of your submission at any time here:
    </p>
    <p style="margin:0 0 24px 0;text-align:center;">
      <a href="${statusUrl}" style="display:inline-block;background-color:#006B3C;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:6px;">Check submission status</a>
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Questions? Email us at <a href="mailto:${ADMIN_EMAIL}" style="color:#006B3C;text-decoration:none;font-weight:600;">${ADMIN_EMAIL}</a>.
    </p>`
  );

  const text = `Hi ${opts.authorName},

Thank you for submitting your ${typeLabel} to the HK Masters Hockey Journal!

We've received your submission "${opts.title}" and it is now under review. We'll email you once it's been approved or declined.

Check your submission status: ${statusUrl}

Questions? Email us at ${ADMIN_EMAIL}.

The HK Masters Hockey Team`;

  await sendEmail({
    to: opts.authorEmail,
    subject: `We've received your submission: "${opts.title}"`,
    html,
    text,
  });
}

export async function sendNewContributionEmail(opts: {
  authorName: string;
  authorEmail: string;
  contentType: string;
  title: string;
  contributionId: number;
}) {
  const typeLabel =
    opts.contentType === "article"
      ? "Article"
      : opts.contentType === "photo"
        ? "Photo submission"
        : "Article + Photos";

  const reviewUrl = `${ADMIN_APP_URL}/journal?id=${opts.contributionId}`;
  const safeName = escapeHtml(opts.authorName);
  const safeTitle = escapeHtml(opts.title);
  const safeEmail = escapeHtml(opts.authorEmail);

  const html = emailShell(
    "#1e3a5f",
    "New Journal submission",
    `<p style="margin:0 0 20px 0;font-size:16px;font-weight:700;color:#1f2937;">New Journal Submission</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;width:120px;">Type</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;">${typeLabel}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Title</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;font-weight:600;">${safeTitle}</td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Author</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;">${safeName}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Email</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;"><a href="mailto:${safeEmail}" style="color:#006B3C;text-decoration:none;">${safeEmail}</a></td>
      </tr>
    </table>
    <p style="margin:0 0 20px 0;text-align:center;">
      <a href="${reviewUrl}" style="display:inline-block;background-color:#006B3C;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:6px;">Review in Admin Panel</a>
    </p>
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Contribution #${opts.contributionId}</p>`
  );

  const text = `New Journal submission received:

Type: ${typeLabel}
Title: ${opts.title}
From: ${opts.authorName} <${opts.authorEmail}>

Review and approve or decline:
${reviewUrl}

Contribution #${opts.contributionId}`;

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[HK Masters Journal] New submission: "${opts.title}"`,
    html,
    text,
  });
  console.log(`[email] Admin notification sent for contribution #${opts.contributionId}`);
}

function buildDecisionEmailHtml(opts: {
  authorName: string;
  title: string;
  status: "approved" | "declined";
  adminNote?: string;
  contributionId?: number;
  slug?: string;
  editDetails?: {
    titleChanged?: { from: string; to: string };
    photosRemovedCount?: number;
  };
}): string {
  const isApproved = opts.status === "approved";

  const badgeBg = isApproved ? "#006B3C" : "#c0392b";
  const badgeText = isApproved ? "Approved" : "Declined";
  const badgeIcon = isApproved ? "✓" : "✕";

  const bodyMessage = isApproved
    ? `We're pleased to let you know that your submission has been approved and will be featured in the HK Masters Hockey Journal.`
    : `After careful review, we're sorry to inform you that your submission was not accepted for the HK Masters Hockey Journal at this time.`;

  const safeAuthorName = escapeHtml(opts.authorName);
  const safeTitle = escapeHtml(opts.title);

  const noteSection = opts.adminNote
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="border-left: 4px solid #006B3C; padding: 12px 16px; background-color: #f0f7f4; border-radius: 0 6px 6px 0;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #006B3C;">Note from the team</p>
            <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">${escapeHtml(opts.adminNote).replace(/\n/g, "<br>")}</p>
          </td>
        </tr>
      </table>`
    : "";

  const editLines: string[] = [];
  if (opts.editDetails?.titleChanged) {
    const { from, to } = opts.editDetails.titleChanged;
    editLines.push(
      `<li style="margin:0 0 6px 0;">Your title was updated from <em>&ldquo;${escapeHtml(from)}&rdquo;</em> to <strong>&ldquo;${escapeHtml(to)}&rdquo;</strong>.</li>`
    );
  }
  if (opts.editDetails?.photosRemovedCount) {
    const n = opts.editDetails.photosRemovedCount;
    editLines.push(
      `<li style="margin:0 0 6px 0;"><strong>${n} photo${n !== 1 ? "s were" : " was"}</strong> removed from your submission.</li>`
    );
  }
  const editSectionLabel = isApproved ? "Edits made before approval" : "Edits made during review";
  const editSection =
    editLines.length > 0
      ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="border-left: 4px solid #f59e0b; padding: 12px 16px; background-color: #fffbeb; border-radius: 0 6px 6px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #b45309;">${editSectionLabel}</p>
            <ul style="margin: 0; padding: 0 0 0 18px; font-size: 15px; color: #374151; line-height: 1.6;">
              ${editLines.join("\n              ")}
            </ul>
          </td>
        </tr>
      </table>`
      : "";

  const journalUrl = opts.slug
    ? `${PUBLIC_URL}/journal/${opts.slug}`
    : opts.contributionId
    ? `${PUBLIC_URL}/journal/${opts.contributionId}`
    : `${PUBLIC_URL}/journal`;

  const viewInJournalButton = isApproved
    ? `
    <p style="margin:0 0 24px 0;text-align:center;">
      <a href="${journalUrl}" style="display:inline-block;background-color:#006B3C;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:6px;">View in Journal</a>
    </p>`
    : "";

  return emailShell(
    "#006B3C",
    `${badgeText}: ${safeTitle}`,
    `<p style="text-align:center;margin:0 0 24px 0;">
      <span style="display:inline-block;background-color:${badgeBg};color:#ffffff;font-size:15px;font-weight:700;padding:8px 22px;border-radius:50px;letter-spacing:0.04em;">${badgeIcon}&nbsp;&nbsp;${badgeText}</span>
    </p>
    <p style="margin:0 0 16px 0;font-size:16px;color:#1f2937;line-height:1.6;">Hi ${safeAuthorName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">Thank you for your submission to the <strong>HK Masters Hockey Journal</strong>.</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">Your submission <strong>&ldquo;${safeTitle}&rdquo;</strong> has been <strong>${opts.status}</strong>.</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">${bodyMessage}</p>
    ${editSection}
    ${noteSection}
    ${viewInJournalButton}
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Questions? <a href="mailto:${ADMIN_EMAIL}" style="color:#006B3C;text-decoration:none;font-weight:600;">${ADMIN_EMAIL}</a>
    </p>`
  );
}

function buildDecisionEmailText(opts: {
  authorName: string;
  title: string;
  status: "approved" | "declined";
  adminNote?: string;
  contributionId?: number;
  slug?: string;
  editDetails?: {
    titleChanged?: { from: string; to: string };
    photosRemovedCount?: number;
  };
}): string {
  const isApproved = opts.status === "approved";
  const decision = isApproved ? "approved" : "declined";
  const noteSection = opts.adminNote
    ? `\nNote from the team:\n${opts.adminNote}\n`
    : "";

  const editLines: string[] = [];
  if (opts.editDetails?.titleChanged) {
    const { from, to } = opts.editDetails.titleChanged;
    editLines.push(`- Your title was updated from "${from}" to "${to}".`);
  }
  if (opts.editDetails?.photosRemovedCount) {
    const n = opts.editDetails.photosRemovedCount;
    editLines.push(`- ${n} photo${n !== 1 ? "s were" : " was"} removed from your submission.`);
  }
  const editSectionLabel = opts.status === "approved" ? "Edits made before approval" : "Edits made during review";
  const editSection =
    editLines.length > 0
      ? `\n${editSectionLabel}:\n${editLines.join("\n")}\n`
      : "";

  const journalUrl = opts.slug
    ? `${PUBLIC_URL}/journal/${opts.slug}`
    : opts.contributionId
    ? `${PUBLIC_URL}/journal/${opts.contributionId}`
    : `${PUBLIC_URL}/journal`;
  const viewInJournalSection = isApproved
    ? `\nView your published piece in the journal:\n${journalUrl}\n`
    : "";

  return `Hi ${opts.authorName},

Thank you for your submission to the HK Masters Hockey Journal.

Your submission "${opts.title}" has been ${decision}.
${editSection}${noteSection}${viewInJournalSection}
If you have any questions, feel free to reach out to us at ${ADMIN_EMAIL}.

The HK Masters Hockey Team`.trim();
}

export async function sendContributionDeletedEmail(opts: {
  authorName: string;
  authorEmail: string;
  title: string;
  contentType: string;
  contributionId: number;
  status: "pending" | "approved" | "declined";
}) {
  const typeLabel =
    opts.contentType === "article"
      ? "Article"
      : opts.contentType === "photo"
        ? "Photo submission"
        : "Article + Photos";

  const safeName = escapeHtml(opts.authorName);
  const safeTitle = escapeHtml(opts.title);
  const safeEmail = escapeHtml(opts.authorEmail);
  const safeStatus = escapeHtml(opts.status);

  const html = emailShell(
    "#7f1d1d",
    "Submission deleted",
    `<p style="margin:0 0 20px 0;font-size:16px;font-weight:700;color:#1f2937;">Submission Deleted</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      A journal submission that you received a review link for has been <strong>permanently deleted</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;width:140px;">Type</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;">${typeLabel}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Title</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;font-weight:600;">${safeTitle}</td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Author</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;">${safeName}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Author Email</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;"><a href="mailto:${safeEmail}" style="color:#006B3C;text-decoration:none;">${safeEmail}</a></td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Status at deletion</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;text-transform:capitalize;">${safeStatus}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Contribution #${opts.contributionId} has been removed from the system.</p>`
  );

  const text = `Journal Submission Deleted

A submission you received a review link for has been permanently deleted.

Type: ${typeLabel}
Title: ${opts.title}
Author: ${opts.authorName} <${opts.authorEmail}>
Status at deletion: ${opts.status}

Contribution #${opts.contributionId} has been removed from the system.`;

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[HK Masters Journal] Submission deleted: "${opts.title}"`,
    html,
    text,
  });
  console.log(`[email] Admin deletion notification sent for contribution #${opts.contributionId}`);
}

export async function sendContributionDeletionNoticeToAuthorEmail(opts: {
  authorName: string;
  authorEmail: string;
  title: string;
  contentType: string;
  contributionId: number;
  reason?: string;
}) {
  const typeLabel =
    opts.contentType === "article"
      ? "article"
      : opts.contentType === "photo"
        ? "photo submission"
        : "article and photos";

  const safeName = escapeHtml(opts.authorName);
  const safeTitle = escapeHtml(opts.title);
  const safeReason = opts.reason ? escapeHtml(opts.reason.trim()) : null;

  const reasonHtml = safeReason
    ? `<p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      <strong>Reason:</strong> ${safeReason}
    </p>`
    : "";

  const reasonText = safeReason ? `\nReason: ${safeReason}\n` : "";

  const html = emailShell(
    "#006B3C",
    "Submission removed",
    `<p style="margin:0 0 16px 0;font-size:16px;color:#1f2937;line-height:1.6;">Hi ${safeName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      We're writing to let you know that your ${typeLabel} <strong>&ldquo;${safeTitle}&rdquo;</strong> has been removed from the <strong>HK Masters Hockey Journal</strong>.
    </p>
    ${reasonHtml}<p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      If you believe this was done in error, or if you'd like to resubmit, please don't hesitate to get in touch with us.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Questions? Email us at <a href="mailto:${ADMIN_EMAIL}" style="color:#006B3C;text-decoration:none;font-weight:600;">${ADMIN_EMAIL}</a>.
    </p>`
  );

  const text = `Hi ${opts.authorName},

We're writing to let you know that your ${typeLabel} "${opts.title}" has been removed from the HK Masters Hockey Journal.
${reasonText}
If you believe this was done in error, or if you'd like to resubmit, please don't hesitate to get in touch.

Questions? Email us at ${ADMIN_EMAIL}.

The HK Masters Hockey Team`;

  await sendEmail({
    to: opts.authorEmail,
    subject: `Your submission has been removed: "${opts.title}"`,
    html,
    text,
  });
  console.log(`[email] Author deletion notice sent for contribution #${opts.contributionId}`);
}

export async function sendOnboardingInviteEmail(opts: {
  playerName: string;
  playerEmail: string;
  teamName: string;
  accessToken: string;
}): Promise<boolean> {
  const safeName = escapeHtml(opts.playerName);
  const safeTeam = escapeHtml(opts.teamName);
  const link = `${PUBLIC_URL}/my-details/${encodeURIComponent(opts.accessToken)}`;

  const html = emailShell(
    "#006B3C",
    "Complete your tournament profile",
    `<p style="margin:0 0 16px 0;font-size:16px;color:#1f2937;line-height:1.6;">Hi ${safeName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      You're confirmed on the <strong>${safeTeam}</strong> roster for the <strong>HK 2026 Masters World Cup</strong> in Rotterdam (22 July – 1 August 2026). Exciting times!
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      To finalise your spot, we need a few personal details — passport info, flight plans, kit sizes, dietary requirements and emergency contact. You can fill it all in via your private link below. No password needed; just click and go.
    </p>
    <p style="margin:0 0 24px 0;text-align:center;">
      <a href="${link}" style="display:inline-block;background-color:#006B3C;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:6px;">Complete my details</a>
    </p>
    <p style="margin:0 0 16px 0;font-size:13px;color:#6b7280;line-height:1.6;">
      Or paste this link into your browser:<br>
      <a href="${link}" style="color:#006B3C;text-decoration:none;word-break:break-all;">${link}</a>
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#6b7280;line-height:1.6;">
      You can come back to update your details any time before the tournament.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Questions? Email us at <a href="mailto:${ADMIN_EMAIL}" style="color:#006B3C;text-decoration:none;font-weight:600;">${ADMIN_EMAIL}</a>.
    </p>`
  );

  const text = `Hi ${opts.playerName},

You're confirmed on the ${opts.teamName} roster for the HK 2026 Masters World Cup in Rotterdam (22 July – 1 August 2026).

To finalise your spot, we need a few personal details — passport info, flight plans, kit sizes, dietary requirements and emergency contact. Fill it all in via your private link below — no password needed.

Complete your details: ${link}

You can come back to update your details any time before the tournament.

Questions? Email ${ADMIN_EMAIL}.

The HK Masters Hockey Team`;

  return sendEmail({
    to: opts.playerEmail,
    subject: "Complete your HK 2026 Masters World Cup profile",
    html,
    text,
  });
}

export async function sendTravelReminderEmail(opts: {
  playerName: string;
  playerEmail: string;
  teamName: string;
}): Promise<boolean> {
  const safeName = escapeHtml(opts.playerName);
  const safeTeam = escapeHtml(opts.teamName);

  const html = emailShell(
    "#006B3C",
    "Travel details needed",
    `<p style="margin:0 0 16px 0;font-size:16px;color:#1f2937;line-height:1.6;">Hi ${safeName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      We're writing on behalf of <strong>${safeTeam}</strong> as part of the <strong>HK 2026 Masters World Cup</strong> preparations.
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      Our records show that your <strong>flight details have not yet been submitted</strong>. With the tournament approaching, we need this information to coordinate transport, transfers, and accommodation arrangements.
    </p>
    <p style="margin:0 0 8px 0;font-size:15px;color:#374151;line-height:1.7;">Please get in touch with your team manager as soon as possible and provide:</p>
    <ul style="margin:0 0 24px 0;padding-left:20px;font-size:15px;color:#374151;line-height:1.8;">
      <li>Flight arrival date &amp; time</li>
      <li>Flight departure date &amp; time</li>
      <li>Arrival airport / city</li>
      <li>Room sharing preference (shared or single)</li>
    </ul>
    <p style="margin:0 0 24px 0;text-align:center;">
      <a href="mailto:${ADMIN_EMAIL}?subject=Travel%20details%20for%20HK%202026%20Masters%20World%20Cup" style="display:inline-block;background-color:#006B3C;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:6px;">Submit my travel details</a>
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#6b7280;line-height:1.6;">
      You can also visit our website for more information: <a href="${PUBLIC_URL}" style="color:#006B3C;text-decoration:none;font-weight:600;">${PUBLIC_URL}</a>
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      We look forward to seeing you in the Netherlands!
    </p>`
  );

  const text = `Hi ${opts.playerName},

We're writing on behalf of ${opts.teamName} as part of the HK 2026 Masters World Cup preparations.

Our records show that your flight details have not yet been submitted. With the tournament approaching, we need this information to coordinate transport, transfers, and accommodation arrangements.

Please get in touch with your team manager as soon as possible and provide:
- Flight arrival date & time
- Flight departure date & time
- Arrival airport / city
- Room sharing preference (shared or single)

Reply to this email or contact us at ${ADMIN_EMAIL} to submit your details.

Tournament website: ${PUBLIC_URL}

We look forward to seeing you in the Netherlands!

The HK Masters Hockey Team`;

  return sendEmail({
    to: opts.playerEmail,
    subject: `[Action Required] Please submit your travel details – HK 2026 Masters World Cup`,
    html,
    text,
  });
}

export async function sendFeeReminderEmail(opts: {
  playerName: string;
  playerEmail: string;
  teamName: string;
  amountDue?: number | null;
  amountPaid?: number | null;
}): Promise<boolean> {
  const safeName = escapeHtml(opts.playerName);
  const safeTeam = escapeHtml(opts.teamName);

  const formatAmount = (n: number) =>
    `HK$${n.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const due = typeof opts.amountDue === "number" ? opts.amountDue : null;
  const paid = typeof opts.amountPaid === "number" ? opts.amountPaid : 0;
  const outstanding = due !== null ? Math.max(0, due - paid) : null;

  const amountRows: string[] = [];
  if (due !== null) {
    amountRows.push(
      `<tr style="background-color:#f9fafb;">
         <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;width:160px;">Amount due</td>
         <td style="padding:10px 16px;font-size:14px;color:#1f2937;">${formatAmount(due)}</td>
       </tr>`
    );
  }
  if (paid > 0) {
    amountRows.push(
      `<tr>
         <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Already paid</td>
         <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;">${formatAmount(paid)}</td>
       </tr>`
    );
  }
  if (outstanding !== null && outstanding > 0) {
    amountRows.push(
      `<tr style="background-color:#fef3c7;">
         <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Outstanding balance</td>
         <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#b45309;border-top:1px solid #e5e7eb;">${formatAmount(outstanding)}</td>
       </tr>`
    );
  }

  const amountTable = amountRows.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${amountRows.join("")}</table>`
    : "";

  const html = emailShell(
    "#006B3C",
    "Tournament fee reminder",
    `<p style="margin:0 0 16px 0;font-size:16px;color:#1f2937;line-height:1.6;">Hi ${safeName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      We're writing on behalf of <strong>${safeTeam}</strong> regarding your tournament contribution for the <strong>HK 2026 Masters World Cup</strong>.
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      Our records show that your tournament fee has <strong>not yet been received</strong>. With the tournament approaching, please arrange your payment as soon as possible so we can finalise team logistics and bookings.
    </p>
    ${amountTable}
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      Please contact your team manager for bank transfer details, or reply to this email if you've already paid and we'll update our records.
    </p>
    <p style="margin:0 0 24px 0;text-align:center;">
      <a href="mailto:${ADMIN_EMAIL}?subject=HK%202026%20Masters%20World%20Cup%20fee%20payment" style="display:inline-block;background-color:#006B3C;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:6px;">Get in touch about my fee</a>
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Thank you for your support — we look forward to seeing you in the Netherlands!
    </p>`
  );

  const amountText: string[] = [];
  if (due !== null) amountText.push(`Amount due: ${formatAmount(due)}`);
  if (paid > 0) amountText.push(`Already paid: ${formatAmount(paid)}`);
  if (outstanding !== null && outstanding > 0) amountText.push(`Outstanding balance: ${formatAmount(outstanding)}`);

  const text = `Hi ${opts.playerName},

We're writing on behalf of ${opts.teamName} regarding your tournament contribution for the HK 2026 Masters World Cup.

Our records show that your tournament fee has not yet been received. With the tournament approaching, please arrange your payment as soon as possible so we can finalise team logistics and bookings.
${amountText.length > 0 ? `\n${amountText.join("\n")}\n` : ""}
Please contact your team manager for bank transfer details, or reply to this email if you've already paid and we'll update our records.

Get in touch: ${ADMIN_EMAIL}

Thank you for your support — we look forward to seeing you in the Netherlands!

The HK Masters Hockey Team`;

  return sendEmail({
    to: opts.playerEmail,
    subject: `[Action Required] Tournament fee reminder – HK 2026 Masters World Cup`,
    html,
    text,
  });
}

export async function sendNewPledgeEmail(opts: {
  donorName: string;
  donorEmail?: string;
  amount: number;
  note?: string;
  pledgeId: number;
  status?: string;
}) {
  const safeName = escapeHtml(opts.donorName);
  const safeNote = opts.note ? escapeHtml(opts.note) : null;
  const statusLabel = opts.status ?? "pending";
  const formattedAmount = `HK$${opts.amount.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const emailRow = opts.donorEmail
    ? `<tr>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Email</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;"><a href="mailto:${escapeHtml(opts.donorEmail)}" style="color:#006B3C;text-decoration:none;">${escapeHtml(opts.donorEmail)}</a></td>
      </tr>`
    : "";

  const noteRow = safeNote
    ? `<tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;width:120px;">Note</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;">${safeNote}</td>
      </tr>`
    : "";

  const html = emailShell(
    "#006B3C",
    "New Pledge Received",
    `<p style="margin:0 0 20px 0;font-size:16px;font-weight:700;color:#1f2937;">New Fundraising Pledge</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;width:120px;">Name</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;">${safeName}</td>
      </tr>
      ${emailRow}
      <tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Amount Pledged</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#006B3C;border-top:1px solid #e5e7eb;">${formattedAmount}</td>
      </tr>
      ${noteRow}
    </table>
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Pledge #${opts.pledgeId} — status: ${statusLabel}</p>`
  );

  const text = `New Fundraising Pledge Received

Name: ${opts.donorName}
${opts.donorEmail ? `Email: ${opts.donorEmail}\n` : ""}Amount Pledged: ${formattedAmount}${opts.note ? `\nNote: ${opts.note}` : ""}

Pledge #${opts.pledgeId} — status: ${statusLabel}`;

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[HK Masters] New pledge from ${opts.donorName} — ${formattedAmount}`,
    html,
    text,
  });
  console.log(`[email] Admin pledge notification sent for pledge #${opts.pledgeId}`);
}

export async function sendPledgeConfirmationEmail(opts: {
  donorName: string;
  donorEmail: string;
  amount: number;
  note?: string;
  pledgeId: number;
}) {
  const safeName = escapeHtml(opts.donorName);
  const safeNote = opts.note ? escapeHtml(opts.note) : null;
  const formattedAmount = `HK$${opts.amount.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const noteSection = safeNote
    ? `<p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
        Your message: <em>&ldquo;${safeNote}&rdquo;</em>
      </p>`
    : "";

  const html = emailShell(
    "#006B3C",
    "Thank you for your pledge",
    `<p style="margin:0 0 16px 0;font-size:16px;color:#1f2937;line-height:1.6;">Hi ${safeName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      Thank you for your generous support of the <strong>HK Masters Hockey 2026 World Cup</strong>! We've received your pledge and truly appreciate your commitment to the team.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;width:160px;">Pledge amount</td>
        <td style="padding:12px 16px;font-size:16px;font-weight:700;color:#006B3C;">${formattedAmount}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Reference</td>
        <td style="padding:12px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;">Pledge #${opts.pledgeId}</td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Status</td>
        <td style="padding:12px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;">Pending — a team member will be in touch</td>
      </tr>
    </table>
    ${noteSection}
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      A member of our team will follow up with you shortly to arrange the next steps for your pledge.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Questions? Email us at <a href="mailto:${ADMIN_EMAIL}" style="color:#006B3C;text-decoration:none;font-weight:600;">${ADMIN_EMAIL}</a>.
    </p>`
  );

  const text = `Hi ${opts.donorName},

Thank you for your generous support of the HK Masters Hockey 2026 World Cup! We've received your pledge and truly appreciate your commitment to the team.

Pledge amount: ${formattedAmount}
Reference: Pledge #${opts.pledgeId}
Status: Pending — a team member will be in touch${opts.note ? `\n\nYour message: "${opts.note}"` : ""}

A member of our team will follow up with you shortly to arrange the next steps for your pledge.

Questions? Email us at ${ADMIN_EMAIL}.

The HK Masters Hockey Team`;

  await sendEmail({
    to: opts.donorEmail,
    subject: `Thank you for your pledge — HK Masters Hockey 2026`,
    html,
    text,
  });
  console.log(`[email] Pledge confirmation sent to ${opts.donorEmail} for pledge #${opts.pledgeId}`);
}

export async function sendPledgeReceivedEmail(opts: {
  donorName: string;
  donorEmail: string;
  amount: number;
  pledgeId: number;
}) {
  const safeName = escapeHtml(opts.donorName);
  const formattedAmount = `HK$${opts.amount.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const html = emailShell(
    "#006B3C",
    "Payment received — thank you!",
    `<p style="margin:0 0 16px 0;font-size:16px;color:#1f2937;line-height:1.6;">Hi ${safeName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      Great news — we have received your payment for the <strong>HK Masters Hockey 2026 World Cup</strong>. Thank you so much for following through on your pledge; your generosity means a great deal to the entire team.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;width:160px;">Amount received</td>
        <td style="padding:12px 16px;font-size:16px;font-weight:700;color:#006B3C;">${formattedAmount}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Reference</td>
        <td style="padding:12px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;">Pledge #${opts.pledgeId}</td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Status</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#006B3C;border-top:1px solid #e5e7eb;">Received ✓</td>
      </tr>
    </table>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      Please keep this email as your receipt. We look forward to seeing you in Hong Kong!
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Questions? Email us at <a href="mailto:${ADMIN_EMAIL}" style="color:#006B3C;text-decoration:none;font-weight:600;">${ADMIN_EMAIL}</a>.
    </p>`
  );

  const text = `Hi ${opts.donorName},

Great news — we have received your payment for the HK Masters Hockey 2026 World Cup. Thank you so much for following through on your pledge; your generosity means a great deal to the entire team.

Amount received: ${formattedAmount}
Reference: Pledge #${opts.pledgeId}
Status: Received

Please keep this email as your receipt. We look forward to seeing you in Hong Kong!

Questions? Email us at ${ADMIN_EMAIL}.

The HK Masters Hockey Team`;

  const donorSent = await sendEmail({
    to: opts.donorEmail,
    subject: `Payment received — thank you for supporting HK Masters Hockey 2026`,
    html,
    text,
  });

  if (!donorSent) {
    console.error(`[email] Skipping admin confirmation for pledge #${opts.pledgeId} — donor email failed to deliver`);
    return;
  }
  console.log(`[email] Pledge received confirmation sent to ${opts.donorEmail} for pledge #${opts.pledgeId}`);

  const adminHtml = emailShell(
    "#1e3a5f",
    "Thank-you email dispatched",
    `<p style="margin:0 0 20px 0;font-size:16px;font-weight:700;color:#1f2937;">Thank-you Email Sent to Donor</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
      A payment confirmation / thank-you email was successfully dispatched to the donor listed below.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;width:160px;">Donor</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;">${escapeHtml(opts.donorName)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Email</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;"><a href="mailto:${escapeHtml(opts.donorEmail)}" style="color:#006B3C;text-decoration:none;">${escapeHtml(opts.donorEmail)}</a></td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Amount received</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#006B3C;border-top:1px solid #e5e7eb;">${formattedAmount}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;border-top:1px solid #e5e7eb;">Reference</td>
        <td style="padding:10px 16px;font-size:14px;color:#1f2937;border-top:1px solid #e5e7eb;">Pledge #${opts.pledgeId}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">This is an automated confirmation — no action required.</p>`
  );

  const adminText = `Thank-you Email Dispatched — Pledge #${opts.pledgeId}

A payment confirmation email was successfully sent to the donor.

Donor: ${opts.donorName}
Email: ${opts.donorEmail}
Amount received: ${formattedAmount}
Reference: Pledge #${opts.pledgeId}

This is an automated confirmation — no action required.`;

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[HK Masters] Thank-you email sent to ${opts.donorName} — Pledge #${opts.pledgeId}`,
    html: adminHtml,
    text: adminText,
  });
  console.log(`[email] Admin confirmation sent for pledge #${opts.pledgeId} thank-you to ${opts.donorEmail}`);
}

export async function sendContributionDecisionEmail(opts: {
  authorName: string;
  authorEmail: string;
  title: string;
  status: "approved" | "declined";
  adminNote?: string;
  contributionId: number;
  slug?: string;
  editDetails?: {
    titleChanged?: { from: string; to: string };
    photosRemovedCount?: number;
  };
}) {
  const subject =
    opts.status === "approved"
      ? `Your submission "${opts.title}" has been approved`
      : `Your submission "${opts.title}" has been declined`;

  const html = buildDecisionEmailHtml(opts);
  const text = buildDecisionEmailText(opts);

  await sendEmail({ to: opts.authorEmail, subject, html, text });
}
