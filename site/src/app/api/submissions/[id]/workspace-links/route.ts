import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const linkSchema = z.object({
  provider: z.string().trim().min(1).max(60),
  workspaceName: z.string().trim().min(1).max(160),
  editorEmail: z.string().trim().max(200).email().optional(),
});

// Connects (or re-connects, overwriting the prior name/email) one external
// editing workspace to this submission — the Submit Project page's
// Collaboration Hub. Upserts by (submissionId, provider): re-connecting the
// same provider updates the existing row instead of erroring. No password
// field — see SubmissionWorkspaceLink's own doc comment for why that stays
// client-only.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({ select: { userId: true }, where: { id } });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }

  const parsed = linkSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "invalid_request",
        message: firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Invalid request.",
      },
      { status: 400 },
    );
  }

  const link = await prisma.submissionWorkspaceLink.upsert({
    create: {
      editorEmail: parsed.data.editorEmail || null,
      provider: parsed.data.provider,
      submissionId: id,
      workspaceName: parsed.data.workspaceName,
    },
    update: {
      editorEmail: parsed.data.editorEmail || null,
      workspaceName: parsed.data.workspaceName,
    },
    where: { submissionId_provider: { provider: parsed.data.provider, submissionId: id } },
  });

  return NextResponse.json({ link });
});
