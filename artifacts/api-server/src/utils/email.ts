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
