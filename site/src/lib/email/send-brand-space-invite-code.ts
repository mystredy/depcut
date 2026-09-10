import BrandSpaceInviteCodeEmail from "@/emails/brand-space-invite-code";
import { emailFrom, getResend, isResendConfigured } from "@/lib/email/resend";

// Unlike sendWelcomeEmail, this always sends — every code request is a
// fresh, deliberate ask, not a once-ever lifecycle email. Throws instead of
// swallowing a misconfigured Resend, since the caller can't finish this
// action without the code actually reaching an inbox.
export async function sendBrandSpaceInviteCode(params: {
  requesterEmail: string;
  spaceName: string;
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
    react: BrandSpaceInviteCodeEmail({
      code: params.code,
      inviteEmail: params.inviteEmail,
      spaceName: params.spaceName,
    }),
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
}
