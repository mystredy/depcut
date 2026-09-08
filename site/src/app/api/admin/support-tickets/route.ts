import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every support ticket, newest first, with its full
// message thread — each message's author resolved to a display name so the
// admin page never has to look users up itself.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await prisma.supportTicket.findMany({
    include: {
      user: { select: { displayName: true, email: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          // Each attachment's bytes never ride the list — id and
          // contentType alone are enough to link to the route that serves
          // them.
          attachments: { select: { contentType: true, id: true } },
          author: { select: { displayName: true, email: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    tickets: rows.map((row) => ({
      id: row.id,
      number: row.number,
      subject: row.subject,
      status: row.status,
      priority: row.priority,
      createdAt: row.createdAt.toISOString(),
      lastReplyAt: row.lastReplyAt?.toISOString() ?? null,
      raisedByEmail: row.user.email,
      raisedByName: row.user.displayName ?? row.user.name,
      messages: row.messages.map((m) => ({
        id: m.id,
        authorId: m.authorId,
        authorName: m.author.displayName ?? m.author.name,
        message: m.message,
        createdAt: m.createdAt.toISOString(),
        attachments: m.attachments,
      })),
    })),
  });
});
