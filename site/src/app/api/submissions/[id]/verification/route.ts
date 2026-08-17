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

// Pro submissions only — the verification export. Same redirect pattern as
// thumbnail/video; reads the asset row directly so it works pre-promotion
// too (the publishing-package Upload row this used to read from doesn't
// exist yet while the submission is still "submitting").
export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    select: { userId: true },
    where: { id },
  });
  if (!submission) return notFoundResponse();

  const userId = request.donkey.userId;
  if (submission.userId !== userId && !(await isDonkeySuperUser(userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }

  const asset = await prisma.submissionAsset.findUnique({
    select: { storageKey: true },
    where: { submissionId_type: { submissionId: id, type: "verification" } },
  });
  if (!asset?.storageKey) return notFoundResponse();

  const url = await presignGet(asset.storageKey);
  return NextResponse.redirect(url);
});
