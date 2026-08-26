import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every support ticket, newest first.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await prisma.supportTicket.findMany({
    // The attachment's bytes never ride the list — attachmentContentType
    // alone (non-null when one exists) is enough to link to the route that
    // serves them.
    omit: { attachmentData: true },
    include: { user: { select: { displayName: true, email: true, name: true } } },
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
