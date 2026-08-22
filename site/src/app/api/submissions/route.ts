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
// it exists. Idempotent per project: a project can only ever have one open
// (draft) submission at a time, so clicking Submit again on a project that
// already has one continues that draft instead of creating a duplicate and
// silently eating a slot toward MAX_OPEN_DRAFTS.
export const POST = withDonkeyAuth(async (request) => {
  let projectId: string | undefined;
  try {
    const body = (await request.json()) as { projectId?: string };
    if (typeof body.projectId === "string" && body.projectId.trim()) {
      projectId = body.projectId.trim();
    }
  } catch {
    // No body (or invalid JSON) is the normal case for a manual-upload draft.
  }

  let projectName: string | undefined;
  if (projectId) {
    const project = await prisma.cutProject.findUnique({
      select: { name: true },
      where: { id: projectId, userId: request.donkey.userId },
    });
    if (!project) {
      return NextResponse.json({ error: "not_found", message: "Project not found." }, { status: 404 });
    }
    projectName = project.name;
    const existing = await prisma.submission.findFirst({
      where: { projectId, userId: request.donkey.userId, status: "draft" },
      include: { assets: true, project: { select: { name: true } } },
    });
    if (existing) return NextResponse.json({ submission: existing });
  }

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

  // Seeded once, from the project's title at the moment the draft is
  // created — not kept in sync after. The title field then behaves exactly
  // like any other draft field: autosave (PATCH) owns it from here, so
  // renaming the project later doesn't silently retitle an in-progress
  // submission, and renaming the submission doesn't touch the project.
  const submission = await prisma.submission.create({
    data: { status: "draft", userId: request.donkey.userId, projectId, title: projectName },
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
