import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { head } from "@/cut/server/cloud/r2";
import { failSubmissionAsset, tryPromoteSubmission } from "@/lib/marketplace/submission-promotion";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; type: string }> };

const ASSET_TYPES = ["video", "thumbnail", "verification"] as const;

// Verifies the upload actually landed in R2, marks the asset "complete", and
// checks whether the submission itself can now be promoted. The browser
// only ever reports "the bytes are up" here — this route is what decides
// whether that's actually true, and whether it's enough to submit.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, type: rawType } = await context.params;
  if (!ASSET_TYPES.includes(rawType as (typeof ASSET_TYPES)[number])) {
    return NextResponse.json(
      { error: "invalid_asset_type", message: "Invalid asset type." },
      { status: 400 },
    );
  }

  const submission = await prisma.submission.findUnique({
    select: { userId: true },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }

  const asset = await prisma.submissionAsset.findUnique({
    where: { submissionId_type: { submissionId: id, type: rawType } },
  });
  if (!asset?.storageKey) return notFoundResponse();

  const info = await head(asset.storageKey);
  if (!info) {
    await failSubmissionAsset(id, rawType, "The upload never arrived.");
    return NextResponse.json(
      { error: "upload_never_arrived", message: "The upload never arrived." },
      { status: 400 },
    );
  }

  await prisma.submissionAsset.update({
    data: { error: null, status: "complete" },
    where: { id: asset.id },
  });
  await tryPromoteSubmission(id);

  return NextResponse.json({ ok: true });
});
