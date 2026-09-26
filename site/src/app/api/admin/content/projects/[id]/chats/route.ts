import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Super-user only: every AI chat thread ever synced for one project, full
// transcripts included — the AI Skill Builder's other reference source
// alongside the project's own doc/edit log (see ../route.ts's GET). `data`
// is the same opaque client-written payload CutChatThread always is; this
// route doesn't parse it, just hands back every row for the caller to read.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can view this." }, { status: 403 });
  }
  const { id } = await context.params;
  const project = await prisma.cutProject.findUnique({ select: { id: true }, where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found", message: "Project not found." }, { status: 404 });
  }
  const threads = await prisma.cutChatThread.findMany({
    orderBy: { updatedAt: "desc" },
    where: { projectId: id },
  });
  return NextResponse.json({ threads });
});
