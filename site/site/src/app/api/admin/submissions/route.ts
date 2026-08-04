import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Creator submissions (subType "CSVID") awaiting or already
// past review, newest first.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await prisma.submission.findMany({
    include: {
      category: { select: { emoji: true, name: true } },
      task: { select: { id: true, title: true } },
      user: { select: { displayName: true, email: true, name: true } },
    },
    orderBy: { submittedAt: "desc" },
    where: { subType: "CSVID" },
  });

  const submissions = rows.map(({ thumbnailKey, videoKey, ...row }) => ({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewStartedAt: row.reviewStartedAt?.toISOString() ?? null,
    reviewCompletedAt: row.reviewCompletedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    task: row.task,
    hasThumbnail: Boolean(thumbnailKey),
    hasVideo: Boolean(videoKey),
    submitterEmail: row.user.email,
    submitterName: row.user.displayName ?? row.user.name,
    user: undefined,
  }));

  return NextResponse.json({ submissions });
});
