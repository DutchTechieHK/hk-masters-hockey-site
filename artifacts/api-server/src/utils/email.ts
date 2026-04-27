const ADMIN_EMAIL = "play@hkmastershockey.com";
const VERIFIED_FROM = "HK Masters Hockey <noreply@hkmastershockey.com>";
const FALLBACK_FROM = "HK Masters Hockey <onboarding@resend.dev>";

const ADMIN_APP_URL =
  process.env.ADMIN_APP_URL || "https://hk-masters.replit.app";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendNewContributionEmail(opts: {
  authorName: string;
  authorEmail: string;
  contentType: string;
  title: string;
  contributionId: number;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping notification email");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const typeLabel =
    opts.contentType === "article"
      ? "Article"
      : opts.contentType === "photo"
        ? "Photo submission"
        : "Article + Photos";

  const reviewUrl = `${ADMIN_APP_URL}/journal`;

  const body = `
New Journal submission received:

Type: ${typeLabel}
Title: ${opts.title}
From: ${opts.authorName} <${opts.authorEmail}>

Review and approve or decline this submission:
${reviewUrl}
`.trim();

  const subject = `[HK Masters Journal] New submission: "${opts.title}"`;

  let { error } = await resend.emails.send({
    from: VERIFIED_FROM,
    to: ADMIN_EMAIL,
    subject,
    text: body,
  });

  if (error && (error as { statusCode?: number }).statusCode === 403) {
    console.warn("[email] Custom domain not yet verified — retrying with fallback sender");
    ({ error } = await resend.emails.send({
      from: FALLBACK_FROM,
      to: ADMIN_EMAIL,
      subject,
      text: body,
    }));
  }

  if (error) {
    console.error("[email] Failed to send notification:", error);
  } else {
    console.log(`[email] Notification sent for contribution #${opts.contributionId}`);
  }
}

function buildDecisionEmailHtml(opts: {
  authorName: string;
  title: string;
  status: "approved" | "declined";
  adminNote?: string;
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${badgeText}: ${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #006B3C; padding: 28px 32px; text-align: center;">
              <p style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">
                HK Masters Hockey
              </p>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.75); letter-spacing: 0.08em; text-transform: uppercase;">
                2026 World Masters Championship
              </p>
            </td>
          </tr>

          <!-- Badge -->
          <tr>
            <td style="padding: 32px 32px 0 32px; text-align: center;">
              <span style="display: inline-block; background-color: ${badgeBg}; color: #ffffff; font-size: 15px; font-weight: 700; padding: 8px 22px; border-radius: 50px; letter-spacing: 0.04em;">
                ${badgeIcon}&nbsp;&nbsp;${badgeText}
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                Hi ${safeAuthorName},
              </p>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.7;">
                Thank you for your submission to the <strong>HK Masters Hockey Journal</strong>.
              </p>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.7;">
                Your submission <strong>&ldquo;${safeTitle}&rdquo;</strong> has been <strong>${opts.status}</strong>.
              </p>
              <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.7;">
                ${bodyMessage}
              </p>
              ${noteSection}
            </td>
          </tr>

          <!-- Contact -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                If you have any questions, feel free to reach out to us at
                <a href="mailto:${ADMIN_EMAIL}" style="color: #006B3C; text-decoration: none; font-weight: 600;">${ADMIN_EMAIL}</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px; border-top: 1px solid #e5e7eb; margin-top: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; font-weight: 600; color: #006B3C;">The HK Masters Hockey Team</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #9ca3af;">HK 2026 Masters World Cup</p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #006B3C; margin-right: 2px;"></span>
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #DE2910;"></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildDecisionEmailText(opts: {
  authorName: string;
  title: string;
  status: "approved" | "declined";
  adminNote?: string;
}): string {
  const decision = opts.status === "approved" ? "approved" : "declined";
  const noteSection = opts.adminNote
    ? `\nNote from the team:\n${opts.adminNote}\n`
    : "";

  return `Hi ${opts.authorName},

Thank you for your submission to the HK Masters Hockey Journal.

Your submission "${opts.title}" has been ${decision}.
${noteSection}
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
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping decision email");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const decision = opts.status === "approved" ? "approved" : "declined";
  const subject =
    opts.status === "approved"
      ? `Your submission "${opts.title}" has been approved`
      : `Your submission "${opts.title}" has been declined`;

  const html = buildDecisionEmailHtml(opts);
  const text = buildDecisionEmailText(opts);

  let { error } = await resend.emails.send({
    from: VERIFIED_FROM,
    to: opts.authorEmail,
    subject,
    html,
    text,
  });

  if (error && (error as { statusCode?: number }).statusCode === 403) {
    console.warn("[email] Custom domain not yet verified — retrying with fallback sender");
    ({ error } = await resend.emails.send({
      from: FALLBACK_FROM,
      to: opts.authorEmail,
      subject,
      html,
      text,
    }));
  }

  if (error) {
    console.error("[email] Failed to send decision email:", error);
  } else {
    console.log(
      `[email] Decision email (${decision}) sent to ${opts.authorEmail} for contribution #${opts.contributionId}`
    );
  }
}
