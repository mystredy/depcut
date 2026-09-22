import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every studio in the system, regardless of owner — unlike
// GET /api/studios (a signed-in account's own memberships), this backs the
// Permissions dialog's Studios picker, which needs to offer any studio to
// assign a Pro artist to.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can view this." }, { status: 403 });
  }

  const studios = await prisma.studio.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, username: true },
  });

  return NextResponse.json({ studios });
});
