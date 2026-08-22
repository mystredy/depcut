import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { getProject, summarize } from "@/cut/server/cloud/projects";
import { del } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Hydrates the Submit Project editor when resuming an existing draft (or
// watching a "submitting" one finish).
export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    include: {
      assets: true,
      category: { select: { emoji: true, name: true } },
      project: { select: { name: true } },
    },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.donkey.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }
  // The linked project's own preview state — same fields the Projects page
  // reads to decide between the rendered proxy, the raw first-clip frame,
  // and no preview at all — so the submit form's source-project card can
  // show the identical picture instead of a generic icon.
  let project: {
    name: string;
    hasPreview?: boolean;
    previewFile?: string;
    previewIsImage?: boolean;
    previewStart?: number;
  } | null = submission.project;
  if (submission.projectId && project) {
    const row = await getProject(submission.userId, submission.projectId);
    if (row) {
      const { hasPreview, previewFile, previewIsImage, previewStart } = summarize(row, 0);
      project = { ...project, hasPreview, previewFile, previewIsImage, previewStart };
    }
  }
  return NextResponse.json({ submission: { ...submission, project } });
});

// Autosave — every Submit Project field edit lands here, debounced
// client-side. Only reachable while the row is still a draft; once Submit
// fires the row is locked (see /api/submissions/[id]/submit).
const patchSchema = z
  .object({
    burnInCaptions: z.boolean().optional(),
    categoryId: z.string().trim().min(1).optional(),
    editCode: z.string().trim().max(60).optional(),
    extension: z.enum(["standard", "pro"]).optional(),
    generatedMetadata: z.boolean().optional(),
    inspireUrl: z.string().trim().max(2000).optional(),
    packageDescription: z.string().trim().max(2000).optional(),
    packageTags: z.string().trim().max(500).optional(),
    packageTitle: z.string().trim().max(200).optional(),
    spaceid: z.string().trim().max(160).optional(),
    subSource: z.enum(["InspiredExternal", "TaskExternal"]).optional(),
    title: z.string().trim().max(200).optional(),
    voiceScript: z.string().trim().max(5000).optional(),
    watermarkEnabled: z.boolean().optional(),
    watermarkText: z.string().trim().max(120).optional(),
  })
  .strict();

export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    select: { status: true, userId: true },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.donkey.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }
  if (submission.status !== "draft") {
    return NextResponse.json(
      { error: "not_editable", message: "This submission is no longer editable." },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "invalid_request",
        issues: parsed.error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path.join("."),
        })),
        message: firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Invalid request.",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.submission.update({
    data: parsed.data,
    include: {
      assets: true,
      category: { select: { emoji: true, name: true } },
    },
    where: { id },
  });
  return NextResponse.json({ submission: updated });
});

// Deletes an unfinished submission — a draft the creator abandoned, or one
// that failed and they'd rather scrap than retry. Once it's actually
// "submitted" this is refused: that's real review history, not scratch
// work, and isn't this route's business to remove.
export const DELETE = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    include: { assets: true },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.donkey.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }
  if (submission.status !== "draft" && submission.status !== "failed") {
    return NextResponse.json(
      { error: "not_deletable", message: "Only a draft or failed submission can be deleted." },
      { status: 400 },
    );
  }

  const keys = submission.assets.map((a) => a.storageKey).filter((k): k is string => Boolean(k));
  await prisma.submission.delete({ where: { id } });
  await del(keys);

  return NextResponse.json({ ok: true });
});
