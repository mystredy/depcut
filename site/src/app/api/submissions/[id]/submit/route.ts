import { NextResponse } from "next/server";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { tryPromoteSubmission } from "@/lib/marketplace/submission-promotion";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// The creator hit Submit. Doesn't wait on uploads — validates that
// everything required has at least been *picked* (not necessarily
// finished), locks the row out of further editing, records intent
// (submitRequestedAt), and moves to "submitting". Promotes straight to
// "submitted" immediately if every asset already finished uploading;
// otherwise each asset's own /complete callback does that later.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    include: { assets: true },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.donkey.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }
  if (submission.status !== "draft") {
    return NextResponse.json(
      { error: "already_submitted", message: "This submission was already submitted." },
      { status: 400 },
    );
  }

  // A submission linked to an editor project (see POST /api/submissions)
  // satisfies video/thumbnail/verification through that project instead of
  // an uploaded asset — there's nothing to pick.
  const linkedToProject = Boolean(submission.projectId);
  const hasVideo = linkedToProject || submission.assets.some((a) => a.type === "video" && a.storageKey);
  const hasThumbnail =
    linkedToProject || submission.assets.some((a) => a.type === "thumbnail" && a.storageKey);
  const missing: string[] = [];
  if (!submission.title?.trim()) missing.push("title");
  if (!submission.categoryId) missing.push("category");
  if (!hasVideo) missing.push("video");
  if (!hasThumbnail) missing.push("thumbnail");
  if (!submission.spaceid) missing.push("workspace");
  if (!submission.voiceScript?.trim()) missing.push("voice-over script");
  if (!submission.inspireUrl?.trim()) {
    missing.push(submission.subSource === "TaskExternal" ? "task reference" : "inspiration link");
  }
  if (submission.watermarkEnabled && !submission.watermarkText?.trim()) missing.push("watermark text");
  if (submission.extension === "pro") {
    if (!submission.packageTitle?.trim()) missing.push("package title");
    if (!submission.packageDescription?.trim()) missing.push("package description");
    if (!submission.packageTags?.trim()) missing.push("package tags");
    const hasVerification =
      linkedToProject || submission.assets.some((a) => a.type === "verification" && a.storageKey);
    if (!hasVerification) missing.push("verification export");
  }
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "missing_required_fields",
        message: `Still missing: ${missing.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  await prisma.submission.update({
    data: { status: "submitting", submitRequestedAt: new Date() },
    where: { id },
  });
  await tryPromoteSubmission(id);

  const updated = await prisma.submission.findUnique({
    include: { assets: true, category: { select: { emoji: true, name: true } } },
    where: { id },
  });
  return NextResponse.json({ submission: updated });
});
