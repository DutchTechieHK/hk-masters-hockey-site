const ADMIN_EMAIL = "play@hkmastershockey.com";
const VERIFIED_FROM = "HK Masters Hockey <noreply@hkmastershockey.com>";
const FALLBACK_FROM = "HK Masters Hockey <onboarding@resend.dev>";

const ADMIN_APP_URL =
  process.env.ADMIN_APP_URL || "https://hk-masters.replit.app";

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

  const noteSection = opts.adminNote
    ? `\nNote from the team:\n${opts.adminNote}\n`
    : "";

  const body = `
Hi ${opts.authorName},

Thank you for your submission to the HK Masters Hockey Journal.

Your submission "${opts.title}" has been ${decision}.
${noteSection}
If you have any questions, feel free to reach out to us at ${ADMIN_EMAIL}.

The HK Masters Hockey Team
`.trim();

  let { error } = await resend.emails.send({
    from: VERIFIED_FROM,
    to: opts.authorEmail,
    subject,
    text: body,
  });

  if (error && (error as { statusCode?: number }).statusCode === 403) {
    console.warn("[email] Custom domain not yet verified — retrying with fallback sender");
    ({ error } = await resend.emails.send({
      from: FALLBACK_FROM,
      to: opts.authorEmail,
      subject,
      text: body,
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
