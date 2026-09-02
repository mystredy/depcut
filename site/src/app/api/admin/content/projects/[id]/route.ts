import { NextResponse } from "next/server";

import { deleteProjectCascade } from "@/cut/server/cloud/projects";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Super-user only: delete any account's project — the Content → Projects
// list's right-click "Delete project" action, for moderating a report
// without going through the owner. Reuses deleteProjectCascade verbatim
// (same R2 cleanup, usage refund, chat/share/render-job cleanup a normal
// owner delete does) — it already takes userId as a real parameter rather
// than reading it from the session, so the only change here is looking the
// project up without an ownership constraint before calling it.
export const DELETE = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
  }
  const { id } = await context.params;
  const row = await prisma.cutProject.findUnique({ where: { id }, select: { userId: true } });
  if (!row) {
    return NextResponse.json({ error: "Not found", message: "Project not found." }, { status: 404 });
  }
  await deleteProjectCascade(row.userId, id);
  return NextResponse.json({ ok: true });
});
