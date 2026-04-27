const ADMIN_EMAIL = "play@hkmastershockey.com";
const FROM_EMAIL = "HK Masters Hockey <noreply@hkmastershockey.com>";

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

  const body = `
New Journal submission received:

Type: ${typeLabel}
Title: ${opts.title}
From: ${opts.authorName} <${opts.authorEmail}>

Log in to the HK Masters management app to review and approve or decline this submission.
`.trim();

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `[HK Masters Journal] New submission: "${opts.title}"`,
    text: body,
  });

  if (error) {
    console.error("[email] Failed to send notification:", error);
  }
}
