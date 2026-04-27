const ADMIN_EMAIL = "play@hkmastershockey.com";
const VERIFIED_FROM = "HK Masters Hockey <noreply@hkmastershockey.com>";
const FALLBACK_FROM = "HK Masters Hockey <onboarding@resend.dev>";

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
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", opts.to);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  let { error } = await resend.emails.send({
    from: VERIFIED_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error && (error as { statusCode?: number }).statusCode === 403) {
    console.warn("[email] Custom domain not yet verified — retrying with fallback sender");
    ({ error } = await resend.emails.send({
      from: FALLBACK_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }));
  }

  if (error) {
    console.error("[email] Failed to deliver to", opts.to, "—", JSON.stringify(error));
  } else {
    console.log(`[email] Sent to ${opts.to}: "${opts.subject}"`);
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
