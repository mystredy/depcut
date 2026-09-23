import { NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { wakeRenderWorker } from "@/cut/server/cloud/wake";
import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { detectUrlImportPlatform, extractFromUrl, UrlImportError } from "@/lib/marketplace/url-import";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// "VK12345678" — 2 letters + 8 digits, matching lib/telegram/commands.ts's
// generateEditCode.
const CODE_RE = /^[A-Za-z]{2}\d{8}$/;

const bodySchema = z.object({ value: z.string().trim().min(1).max(2000) }).strict();

function invalidCodeResponse() {
  return NextResponse.json(
    { error: "invalid_code", message: "That code isn't valid or has already been used." },
    { status: 400 },
  );
}

// A code is single-use and belongs to whoever it was issued to — see
// lib/telegram/commands.ts's handleEditCodeCallback. Checking it here only
// confirms it's real, unused, and theirs, and sets which studio this
// submission is for — it isn't spent yet. It's only marked used at actual
// Submit time (see /api/submissions/[id]/submit), so an artist who checks a
// code and then abandons the draft hasn't burned it.
async function redeemCode(submissionId: string, userId: string, code: string) {
  const row = await prisma.submissionEditCode.findUnique({
    include: { studio: { select: { name: true } } },
    where: { code },
  });
  if (!row || row.userId !== userId || row.usedAt) return invalidCodeResponse();

  await prisma.submission.update({ data: { studioId: row.studioId }, where: { id: submissionId } });

  return NextResponse.json({ studioName: row.studio.name, kind: "code" as const, valid: true });
}

// A YouTube link identifies the studio by matching its channel against every
// studio this artist is assigned to — the same result a code would have
// given, arrived at a different way. Also pulls title/description/tags and
// the channel handle (into the watermark field) synchronously. The video
// itself needs yt-dlp, which only runs on the Cut cloud render worker (this
// route runs on Vercel, which can't shell out to it — see
// src/cut/server/urlDownload.ts) — queued there instead, and never blocks
// this response. The client polls that job and transcribes once it lands
// (see /api/submissions/[id]/edit-code/transcribe).
async function matchYoutubeLink(submissionId: string, userId: string, url: string) {
  let result: Awaited<ReturnType<typeof extractFromUrl>>;
  try {
    result = await extractFromUrl(url);
  } catch (e) {
    const message = e instanceof UrlImportError ? e.message : "Couldn't read that YouTube video.";
    return NextResponse.json({ error: "youtube_fetch_failed", message }, { status: 400 });
  }

  const assignments = await prisma.artistStudioAssignment.findMany({
    include: { studio: { include: { connections: { where: { platform: "youtube" } } } } },
    where: { userId },
  });

  const handle = result.handle?.replace(/^@/, "").toLowerCase() ?? null;
  const matched = assignments.find((a) =>
    a.studio.connections.some((c) => {
      if (result.channelId && c.platformAccountId && c.platformAccountId === result.channelId) return true;
      if (handle && c.accountHandle && c.accountHandle.replace(/^@/, "").toLowerCase() === handle) return true;
      return false;
    }),
  );
  if (!matched) {
    return NextResponse.json(
      { error: "no_studio_match", message: "This video's channel doesn't match any studio you're assigned to." },
      { status: 400 },
    );
  }

  // Persisted immediately, before the slower best-effort steps below — a
  // stall or failure pulling the video or transcribing it should never cost
  // the channel match and autofill that already succeeded.
  await prisma.submission.update({
    data: {
      studioId: matched.studioId,
      ...(result.description ? { packageDescription: result.description } : {}),
      ...(result.tags.length ? { packageTags: result.tags.join(", ") } : {}),
      ...(result.title ? { packageTitle: result.title } : {}),
      ...(result.handle ? { watermarkText: result.handle } : {}),
    },
    where: { id: submissionId },
  });

  // Queue the video pull on the render worker rather than attempt it here —
  // see this function's doc comment. A submission's own row carries the
  // studio/metadata already written above regardless of how this job goes;
  // the job only owns the video and verification export.
  const job = await prisma.cutRenderJob.create({
    data: {
      kind: "submission_youtube",
      spec: { submissionId, url } as unknown as Prisma.InputJsonValue,
      userId,
    },
  });
  wakeRenderWorker();

  return NextResponse.json({
    studioName: matched.studio.name,
    kind: "youtube" as const,
    handle: result.handle,
    packageDescription: result.description,
    packageTags: result.tags.join(", "),
    packageTitle: result.title,
    valid: true,
    videoJobId: job.id,
  });
}

// Submit Project's Check button. Accepts either a studio edit code or a
// YouTube link — see redeemCode / matchYoutubeLink above for what each does.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    select: { status: true, userId: true },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }
  if (submission.status !== "draft") {
    return NextResponse.json(
      { error: "not_editable", message: "This submission is no longer editable." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }
  const value = parsed.data.value.trim();

  if (CODE_RE.test(value)) return redeemCode(id, request.depcut.userId, value.toUpperCase());
  if (detectUrlImportPlatform(value) === "youtube") return matchYoutubeLink(id, request.depcut.userId, value);

  return NextResponse.json(
    { error: "invalid_format", message: "Doesn't look like an edit code or a YouTube link." },
    { status: 400 },
  );
});
