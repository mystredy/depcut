import { NextResponse } from "next/server";
import { z } from "zod";

import { submissionVideoKey, putObject } from "@/cut/server/cloud/r2";
import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import {
  detectUrlImportPlatform,
  extractFromUrl,
  resolveDownloadUrl,
  UrlImportError,
} from "@/lib/marketplace/url-import";
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
// lib/telegram/commands.ts's handleEditCodeCallback. Redeeming it sets which
// studio (Brand) this submission is for.
async function redeemCode(submissionId: string, userId: string, code: string) {
  const row = await prisma.submissionEditCode.findUnique({
    include: { brand: { select: { name: true } } },
    where: { code },
  });
  if (!row || row.userId !== userId || row.usedAt) return invalidCodeResponse();

  await prisma.$transaction([
    prisma.submissionEditCode.update({
      data: { usedAt: new Date(), usedBySubmissionId: submissionId },
      where: { code },
    }),
    prisma.submission.update({ data: { brandId: row.brandId }, where: { id: submissionId } }),
  ]);

  return NextResponse.json({ brandName: row.brand.name, kind: "code" as const, valid: true });
}

// A YouTube link identifies the studio by matching its channel against every
// studio this artist is assigned to — the same result a code would have
// given, arrived at a different way. Also pulls title/description/tags, and
// best-effort pulls the video itself into the submission's video asset slot.
async function matchYoutubeLink(submissionId: string, userId: string, url: string) {
  let result: Awaited<ReturnType<typeof extractFromUrl>>;
  try {
    result = await extractFromUrl(url);
  } catch (e) {
    const message = e instanceof UrlImportError ? e.message : "Couldn't read that YouTube video.";
    return NextResponse.json({ error: "youtube_fetch_failed", message }, { status: 400 });
  }

  const assignments = await prisma.artistBrandAssignment.findMany({
    include: { brand: { include: { connections: { where: { platform: "youtube" } } } } },
    where: { userId },
  });

  const handle = result.handle?.replace(/^@/, "").toLowerCase() ?? null;
  const matched = assignments.find((a) =>
    a.brand.connections.some((c) => {
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

  // Best-effort: YouTube's format-resolving call is known to hang in this
  // environment for some videos (see resolveDownloadUrl's own guard) — a
  // failure here still leaves the channel match and title/description/tags
  // autofill intact, it just means the video needs a manual upload.
  let videoPulled = false;
  try {
    const download = await resolveDownloadUrl(result);
    if (download) {
      const videoRes = await fetch(download.url);
      if (videoRes.ok) {
        const buffer = Buffer.from(await videoRes.arrayBuffer());
        const mime = videoRes.headers.get("content-type") ?? "video/mp4";
        const key = submissionVideoKey(userId, submissionId, "video.mp4");
        await putObject(key, buffer, mime);
        await prisma.submissionAsset.upsert({
          create: { fileName: "video.mp4", status: "complete", storageKey: key, submissionId, type: "video" },
          update: { error: null, fileName: "video.mp4", status: "complete", storageKey: key },
          where: { submissionId_type: { submissionId, type: "video" } },
        });
        videoPulled = true;
      }
    }
  } catch (e) {
    console.error("edit-code: youtube video pull failed —", e);
  }

  await prisma.submission.update({
    data: {
      brandId: matched.brandId,
      ...(result.description ? { packageDescription: result.description } : {}),
      ...(result.tags.length ? { packageTags: result.tags.join(", ") } : {}),
      ...(result.title ? { packageTitle: result.title } : {}),
    },
    where: { id: submissionId },
  });

  return NextResponse.json({
    brandName: matched.brand.name,
    kind: "youtube" as const,
    packageDescription: result.description,
    packageTags: result.tags.join(", "),
    packageTitle: result.title,
    valid: true,
    videoPulled,
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
