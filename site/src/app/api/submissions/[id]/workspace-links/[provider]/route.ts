import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; provider: string }> };

// Disconnects one workspace from this submission — the Collaboration Hub's
// Disconnect action. deleteMany rather than delete-by-id: no row for this
// provider is a no-op, not an error.
export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, provider } = await context.params;
  const submission = await prisma.submission.findUnique({ select: { userId: true }, where: { id } });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }

  await prisma.submissionWorkspaceLink.deleteMany({ where: { provider, submissionId: id } });
  return NextResponse.json({ ok: true });
});
