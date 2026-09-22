import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { tryPromoteSubmission } from "@/lib/marketplace/submission-promotion";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// "VK12345678" — 2 letters + 8 digits, matching edit-code/route.ts's CODE_RE.
// A submission's editCode only holds a code-shaped string when the artist
// checked a studio code rather than a YouTube link — nothing to spend here
// for the YouTube path, since it never created a SubmissionEditCode row.
const CODE_RE = /^[A-Za-z]{2}\d{8}$/;

// The creator hit Submit. Doesn't wait on uploads — validates that
// everything required has at least been *picked* (not necessarily
// finished), locks the row out of further editing, records intent
// (submitRequestedAt), and moves to "submitting". Promotes straight to
// "submitted" immediately if every asset already finished uploading;
// otherwise each asset's own /complete callback does that later.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    include: { assets: true },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.depcut.userId) {
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
    // Set by a successful Check (see /api/submissions/[id]/edit-code) —
    // a Pro submission always belongs to a studio.
    if (!submission.studioId) missing.push("edit code");
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

  // Spend the studio edit code now, at the moment it's actually used to
  // submit — not back when Check merely confirmed it was valid. updateMany's
  // usedAt: null in the where clause makes this an atomic claim: if the same
  // code was already spent by another submission (checked into more than one
  // draft, then submitted from a different one first), count is 0 and this
  // submit is rejected rather than silently double-spending the code.
  const editCode = submission.editCode?.trim().toUpperCase() ?? "";
  if (submission.extension === "pro" && CODE_RE.test(editCode)) {
    const spent = await prisma.submissionEditCode.updateMany({
      data: { usedAt: new Date(), usedBySubmissionId: id },
      where: { code: editCode, userId: submission.userId, usedAt: null },
    });
    if (spent.count === 0) {
      return NextResponse.json(
        {
          error: "edit_code_no_longer_valid",
          message: "Your edit code is no longer valid — check it again before submitting.",
        },
        { status: 400 },
      );
    }
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
