import type { AdminAction } from "@/lib/admin/action-verification";
import AdminActionCodeEmail from "@/emails/admin-action-code";
import { emailFrom, getResend, isResendConfigured } from "@/lib/email/resend";

const ACTION_LABELS: Record<AdminAction, string> = {
  "grant-super-user": "make super user",
  "revoke-super-user": "remove super user",
};

// Unlike sendWelcomeEmail, this always sends — every code request is a fresh,
// deliberate ask, not a once-ever lifecycle email. Throws instead of
// swallowing a misconfigured Resend, since the caller can't finish this
// action without the code actually reaching an inbox.
export async function sendAdminActionCode(params: {
  action: AdminAction;
  adminEmail: string;
  targetEmail: string;
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
    to: params.adminEmail,
    subject: `Your code: ${params.code}`,
    react: AdminActionCodeEmail({
      actionLabel: ACTION_LABELS[params.action],
      code: params.code,
      targetEmail: params.targetEmail,
    }),
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
}
