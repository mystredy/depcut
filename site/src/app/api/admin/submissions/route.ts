import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Creator submissions (subType "CSVID") that actually
// reached review — excludes drafts still being worked on, "submitting"
// (uploads still landing), and "failed" attempts the creator hasn't
// resubmitted, none of which are admin's business yet. "submitted" and
// whatever the review action below advances it to ("Approved"/"Rejected")
// both show, newest first.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await prisma.submission.findMany({
    include: {
      assets: true,
      category: { select: { emoji: true, name: true } },
      project: { select: { name: true } },
      task: { select: { id: true, title: true } },
      user: { select: { displayName: true, email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    where: { status: { notIn: ["draft", "submitting", "failed"] }, subType: "CSVID" },
  });

  const submissions = rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    hasThumbnail: Boolean(row.projectId) || row.assets.some((a) => a.type === "thumbnail" && a.status === "complete"),
    hasVideo: Boolean(row.projectId) || row.assets.some((a) => a.type === "video" && a.status === "complete"),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewStartedAt: row.reviewStartedAt?.toISOString() ?? null,
    reviewCompletedAt: row.reviewCompletedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    submitterEmail: row.user.email,
    submitterName: row.user.displayName ?? row.user.name,
    user: undefined,
  }));

  return NextResponse.json({ submissions });
});
