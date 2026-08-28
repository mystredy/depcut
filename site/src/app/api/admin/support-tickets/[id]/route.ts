import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    status: z.enum(["Open", "Investigating", "Resolved"]).optional(),
    response: z.string().trim().max(4000).optional(),
  })
  .strict();

// Super-user only. "Reply & Resolve" sends response + status: "Resolved" in
// one call; a bare status change (e.g. marking "Investigating") omits it.
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.supportTicket.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  const parsed = updateSchema.safeParse(await request.json());
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

  const isResolving = parsed.data.status === "Resolved";
  const ticket = await prisma.supportTicket.update({
    data: {
      ...parsed.data,
      ...(isResolving
        ? { resolvedAt: new Date(), resolvedById: request.donkey.userId }
        : {}),
    },
    include: { user: { select: { displayName: true, email: true, name: true } } },
    where: { id },
  });

  // The only surface a raiser has for a reply — there's no ticket-status
  // page and no email send for this yet, just the notification bell.
  if (parsed.data.response) {
    await prisma.notification.create(
      notifyUser({
        body: parsed.data.response,
        title: `Reply to "${ticket.subject}"`,
        userId: ticket.userId,
      })
    );
  }

  return NextResponse.json({
    ticket: {
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      raisedByEmail: ticket.user.email,
      raisedByName: ticket.user.displayName ?? ticket.user.name,
      user: undefined,
    },
  });
});
