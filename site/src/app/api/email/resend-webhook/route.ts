import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { z } from "zod";

import { unauthorizedResponse } from "@/lib/depcut-api-auth";
import { emailFrom, getResend } from "@/lib/email/resend";
import { setMarketingUnsubscribed } from "@/lib/email/unsubscribe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Events this app consumes from Resend's side. Everything else acknowledges
// as a no-op so enabling more events in the dashboard never errors.
//
// - contact.updated: an unsubscribe (or resubscribe) made on Resend's side —
//   a broadcast footer link or a dashboard edit — flows back into the
//   account's own preference row.
// - email.received: inbound mail to a receiving-enabled address (e.g.
//   lumi@contact.depcut.app) — forwarded as-is to INBOUND_FORWARD_EMAIL, so
//   an app-form "contact email" can point here without provisioning a real
//   mailbox. Env rather than code so the open-source repo carries no
//   personal address (same reasoning as RESEND_FROM_EMAIL); unset skips the
//   forward.
const contactUpdatedSchema = z.object({
  data: z.object({
    email: z.string().email(),
    unsubscribed: z.boolean(),
  }),
  type: z.literal("contact.updated"),
});

const emailReceivedSchema = z.object({
  data: z.object({
    email_id: z.string(),
  }),
  type: z.literal("email.received"),
});

// Public exception to withDepCutAuth (docs/guides/backend-apis.md): Resend
// calls this endpoint directly. Every request is Svix-signature-verified
// against RESEND_WEBHOOK_SECRET before it is read.
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return unauthorizedResponse();
  }

  const payload = await request.text();
  let event: unknown;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    });
  } catch {
    return unauthorizedResponse();
  }

  const contactUpdated = contactUpdatedSchema.safeParse(event);
  if (contactUpdated.success) {
    const user = await prisma.user.findUnique({
      select: { id: true },
      where: { email: contactUpdated.data.data.email },
    });
    if (user) {
      await setMarketingUnsubscribed(user.id, contactUpdated.data.data.unsubscribed, {
        mirrorToResend: false,
      });
    }
    return NextResponse.json({ ok: true });
  }

  const emailReceived = emailReceivedSchema.safeParse(event);
  if (emailReceived.success) {
    const forwardTo = process.env.INBOUND_FORWARD_EMAIL;
    const from = emailFrom();
    if (forwardTo && from) {
      await getResend().emails.receiving.forward({
        emailId: emailReceived.data.data.email_id,
        to: forwardTo,
        from,
        passthrough: true,
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
