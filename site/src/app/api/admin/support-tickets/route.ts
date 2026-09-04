import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every support ticket, newest first.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await prisma.supportTicket.findMany({
    include: {
      // Each attachment's bytes never ride the list — id and contentType
      // alone are enough to link to the route that serves them.
      attachments: { select: { contentType: true, id: true } },
      user: { select: { displayName: true, email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    tickets: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      raisedByEmail: row.user.email,
      raisedByName: row.user.displayName ?? row.user.name,
      user: undefined,
    })),
  });
});
