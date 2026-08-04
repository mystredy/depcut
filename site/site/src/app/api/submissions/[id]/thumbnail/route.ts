import { NextResponse } from "next/server";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { presignGet } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Redirects to a short-lived signed R2 GET URL — an <img> can point straight
// at this route and follow the redirect, without us proxying the bytes.
// Viewable by the submission's owner or a super user (admin review too).
export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    select: { thumbnailKey: true, userId: true },
    where: { id },
  });
  if (!submission?.thumbnailKey) return notFoundResponse();

  const userId = request.donkey.userId;
  if (submission.userId !== userId && !(await isDonkeySuperUser(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = await presignGet(submission.thumbnailKey);
  return NextResponse.redirect(url);
});
