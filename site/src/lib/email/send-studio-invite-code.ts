import StudioInviteCodeEmail from "@/emails/studio-invite-code";
import { emailFrom, getResend, isResendConfigured } from "@/lib/email/resend";

// Unlike sendWelcomeEmail, this always sends — every code request is a
// fresh, deliberate ask, not a once-ever lifecycle email. Throws instead of
// swallowing a misconfigured Resend, since the caller can't finish this
// action without the code actually reaching an inbox.
export async function sendStudioInviteCode(params: {
  requesterEmail: string;
  studioName: string;
  inviteEmail: string;
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
    to: params.requesterEmail,
    subject: `Your code: ${params.code}`,
    react: StudioInviteCodeEmail({
      code: params.code,
      inviteEmail: params.inviteEmail,
      studioName: params.studioName,
    }),
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
}
