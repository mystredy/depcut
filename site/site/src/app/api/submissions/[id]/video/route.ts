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

// Redirects to a short-lived signed R2 GET URL — same pattern as the
// thumbnail route.
export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    select: { userId: true, videoKey: true },
    where: { id },
  });
  if (!submission?.videoKey) return notFoundResponse();

  const userId = request.donkey.userId;
  if (submission.userId !== userId && !(await isDonkeySuperUser(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = await presignGet(submission.videoKey);
  return NextResponse.redirect(url);
});
