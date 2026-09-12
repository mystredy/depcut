import StudioDeleteCodeEmail from "@/emails/studio-delete-code";
import { emailFrom, getResend, isResendConfigured } from "@/lib/email/resend";

// Unlike sendWelcomeEmail, this always sends — every code request is a
// fresh, deliberate ask, not a once-ever lifecycle email. Throws instead of
// swallowing a misconfigured Resend, since the caller can't finish this
// action without the code actually reaching an inbox.
export async function sendStudioDeleteCode(params: {
  ownerEmail: string;
  studioName: string;
  code: string;
}): Promise<void> {
  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  const from = emailFrom();
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is not configured.");
  }

  const { error } = await getResend().emails.send({
    from,
    to: params.ownerEmail,
    subject: `Your code: ${params.code}`,
    react: StudioDeleteCodeEmail({ code: params.code, studioName: params.studioName }),
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
}
