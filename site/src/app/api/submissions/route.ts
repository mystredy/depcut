import { NextResponse } from "next/server";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_OPEN_DRAFTS = 3;

// "New Submit" calls this to create a bare draft immediately — no body, no
// fields required yet. Every edit after that autosaves via PATCH
// /api/submissions/[id]; media uploads start on pick against this real id
// (see /api/submissions/[id]/assets/[type]/presign). Nothing here decides
// when the draft is "done" — that's the submit route.
//
// Capped at MAX_OPEN_DRAFTS unfinished drafts per user so someone can't spin
// up an unbounded number of empty rows — they have to finish or delete one
// first (DELETE /api/submissions/[id]).
//
// The editor's own Submit button sends { projectId }: the draft is linked to
// that project instead of the manual video/thumbnail/verification uploads —
// see submit-project's [id] page for how a linked draft renders. The project
// must belong to the caller; a stranger's id 404s rather than leaking whether
// it exists.
export const POST = withDonkeyAuth(async (request) => {
  const openDrafts = await prisma.submission.count({
    where: { status: "draft", userId: request.donkey.userId },
  });
  if (openDrafts >= MAX_OPEN_DRAFTS) {
    return NextResponse.json(
      {
        error: "draft_limit_reached",
        message: `You have ${MAX_OPEN_DRAFTS} drafts in progress. Submit or delete one before starting another.`,
      },
      { status: 400 },
    );
  }

  let projectId: string | undefined;
  try {
    const body = (await request.json()) as { projectId?: string };
    if (typeof body.projectId === "string" && body.projectId.trim()) {
      projectId = body.projectId.trim();
    }
  } catch {
    // No body (or invalid JSON) is the normal case for a manual-upload draft.
  }

  if (projectId) {
    const project = await prisma.cutProject.findUnique({
      select: { id: true },
      where: { id: projectId, userId: request.donkey.userId },
    });
    if (!project) {
      return NextResponse.json({ error: "not_found", message: "Project not found." }, { status: 404 });
    }
  }

  const submission = await prisma.submission.create({
    data: { status: "draft", userId: request.donkey.userId, projectId },
    include: { assets: true, project: { select: { name: true } } },
  });
  return NextResponse.json({ submission });
});

// The signed-in user's own submissions, newest first — feeds My Submissions.
// Includes every draft regardless of how far along it is; the client filters
// by status (draft / submitting / failed / submitted) for the status tabs.
export const GET = withDonkeyAuth(async (request) => {
  const submissions = await prisma.submission.findMany({
    include: {
      assets: true,
      category: { select: { emoji: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    where: { userId: request.donkey.userId },
  });

  return NextResponse.json({ submissions });
});
