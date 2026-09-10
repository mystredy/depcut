import BrandSpaceInviteEmail from "@/emails/brand-space-invite";
import { emailFrom, getResend, isResendConfigured } from "@/lib/email/resend";

// Throws instead of swallowing a misconfigured Resend — the caller can't
// finish sending an invite that never reaches an inbox, same as
// sendAdminActionCode.
export async function sendBrandSpaceInvite(params: {
  toEmail: string;
  spaceName: string;
  inviterName: string;
  acceptUrl: string;
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
    to: params.toEmail,
    subject: `${params.inviterName} invited you to manage ${params.spaceName} on DepCut`,
    react: BrandSpaceInviteEmail({
      acceptUrl: params.acceptUrl,
      inviterName: params.inviterName,
      spaceName: params.spaceName,
    }),
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
}
