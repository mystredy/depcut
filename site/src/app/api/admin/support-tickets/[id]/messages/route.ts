import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { notifyUserEverywhere } from "@/lib/notify";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ message: z.string().trim().min(1).max(4000) }).strict();

// Super-user only: an admin's reply. Adds a message to the thread, moves a
// ticket that isn't already Closed to "Answered", and stamps lastReplyAt —
// the raiser's only surface for this is a notification and (if linked) a
// Telegram DM, same as before; there's no ticket-status page yet.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const ticket = await prisma.supportTicket.findUnique({
    select: { status: true, subject: true, userId: true },
    where: { id },
  });
  if (!ticket) return notFoundResponse();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.supportMessage.create({
      data: { authorId: request.depcut.userId, message: parsed.data.message, ticketId: id },
    }),
    prisma.supportTicket.update({
      data: {
        lastReplyAt: now,
        status: ticket.status === "Closed" ? ticket.status : "Answered",
      },
      where: { id },
    }),
  ]);

  // The only surface a raiser has for a reply — there's no ticket-status
  // page and no email send for this yet. Also DMs Telegram for a raiser
  // who's linked their bot and opted into telegramAlerts.
  await notifyUserEverywhere({
    body: parsed.data.message,
    title: `Reply to "${ticket.subject}"`,
    userId: ticket.userId,
  });

  return NextResponse.json({ ok: true });
});
