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

export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    select: { publishingid: true, userId: true },
    where: { id },
  });
  if (!submission?.publishingid) return notFoundResponse();

  const userId = request.donkey.userId;
  if (submission.userId !== userId && !(await isDonkeySuperUser(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const upload = await prisma.upload.findUnique({
    select: { mediaKey: true },
    where: { id: submission.publishingid },
  });
  if (!upload?.mediaKey) return notFoundResponse();

  const url = await presignGet(upload.mediaKey);
  return NextResponse.redirect(url);
});
