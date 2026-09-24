import { NextResponse } from "next/server";
import { z } from "zod";

import { putObject, submissionThumbnailKey, submissionVerificationKey } from "@/cut/server/cloud/r2";
import { transcribeCloud } from "@/cut/server/cloud/transcribe";
import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import {
  detectUrlImportPlatform,
  downloadYoutubeVideo,
  extractFromUrl,
  extractYoutubeVideoId,
  fetchYoutubeThumbnail,
  UrlImportError,
} from "@/lib/marketplace/url-import";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
// The verification-export pull below can take up to ~2 minutes on top of
// metadata and transcription — matches the maxDuration other long
// external-API routes in this codebase use (browser/run, analytics/run,
// jobs/worker, ...).
export const maxDuration = 300;

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
// lib/telegram/commands.ts's handleEditCodeCallback. Checking it here spends
// it immediately: sets which studio this submission is for and marks the
// code used, so the artist can't hand the same code to a second submission.
// The client locks the edit-code field and the Check button once this
// succeeds (see the studio field on the submission it reads back).
async function redeemCode(submissionId: string, userId: string, code: string) {
  const row = await prisma.submissionEditCode.findUnique({
    include: { studio: { select: { name: true } } },
    where: { code },
  });
  if (!row || row.userId !== userId || row.usedAt) return invalidCodeResponse();

  // usedAt: null in the where clause makes this an atomic claim — a code
  // that raced to a second Check in between the lookup above and here comes
  // back with count 0 instead of silently double-spending it.
  const spent = await prisma.submissionEditCode.updateMany({
    data: { usedAt: new Date(), usedBySubmissionId: submissionId },
    where: { code, usedAt: null },
  });
  if (spent.count === 0) return invalidCodeResponse();

  await prisma.submission.update({ data: { studioId: row.studioId }, where: { id: submissionId } });

  return NextResponse.json({ studioName: row.studio.name, kind: "code" as const, valid: true });
}

// ElevenLabs' Scribe model can transcribe straight from a YouTube link — no
// need to wait on our own video pull first. Best-effort: any failure here
// (not configured, YouTube-side hiccup, timeout) just means no script yet —
// not a failed Check. If the video pull below lands anyway, the client can
// still fall back to /api/submissions/[id]/edit-code/transcribe, which
// transcribes from the uploaded file instead. Guarded with a timeout so a
// stuck transcription never holds up the whole Check response.
async function transcribeYoutubeUrl(userId: string, url: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("sourceUrl", url);
    const res = await Promise.race([
      transcribeCloud.transcribe(userId, new Request("http://internal/transcribe", { body: form, method: "POST" })),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 45_000)),
    ]);
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { cues?: { text: string }[] } | null;
    const transcript = (body?.cues ?? []).map((c) => c.text).join(" ").trim();
    return transcript || null;
  } catch (e) {
    console.error("[edit-code] inline YouTube transcription failed —", e instanceof Error ? e.message : e);
    return null;
  }
}

// Uploads the pulled video into the verification-export slot only — proof
// the artist's own upload (the Video slot, filled in manually) matches what
// actually published on the matched channel. Best-effort, like
// transcribeYoutubeUrl above: any failure just means no verification export
// yet, not a failed Check — the studio match, metadata, and transcript
// already succeeded by the time this runs and shouldn't be thrown away over
// it.
async function pullVerificationExport(submissionId: string, userId: string, url: string): Promise<boolean> {
  try {
    const video = await downloadYoutubeVideo(url);
    if (!video) return false;

    const fileName = "video.mp4";
    const verificationKey = submissionVerificationKey(userId, submissionId, fileName);

    await putObject(verificationKey, video.buffer, video.mime);

    await prisma.submissionAsset.upsert({
      where: { submissionId_type: { submissionId, type: "verification" } },
      create: { submissionId, type: "verification", fileName, storageKey: verificationKey, status: "complete" },
      update: { error: null, fileName, status: "complete", storageKey: verificationKey },
    });

    return true;
  } catch (e) {
    console.error("[edit-code] inline YouTube verification-export pull failed —", e instanceof Error ? e.message : e);
    return false;
  }
}

// Same best-effort shape as pullVerificationExport above, for the thumbnail slot.
// Overwrites any existing thumbnail — matches Check's overall behavior of
// re-deriving everything from the matched video, same as title/description
// pulling in over the artist's own typed draft values.
async function pullYoutubeThumbnail(submissionId: string, userId: string, videoId: string): Promise<boolean> {
  try {
    const thumbnail = await fetchYoutubeThumbnail(videoId);
    if (!thumbnail) return false;

    const key = submissionThumbnailKey(userId, submissionId);
    await putObject(key, thumbnail.buffer, thumbnail.mime);

    await prisma.submissionAsset.upsert({
      where: { submissionId_type: { submissionId, type: "thumbnail" } },
      create: { submissionId, type: "thumbnail", fileName: "thumbnail.jpg", status: "complete", storageKey: key },
      update: { error: null, fileName: "thumbnail.jpg", status: "complete", storageKey: key },
    });

    return true;
  } catch (e) {
    console.error("[edit-code] inline YouTube thumbnail pull failed —", e instanceof Error ? e.message : e);
    return false;
  }
}

// A YouTube link identifies the studio by matching its channel against every
// studio this artist is assigned to — the same result a code would have
// given, arrived at a different way. Also pulls title/description/tags, the
// channel handle (into the watermark field), a transcript, a thumbnail, and
// a verification-export copy of the published video, all synchronously
// within this request. The Video slot itself stays manual — that's the
// artist's own upload, not the published video.
async function matchYoutubeLink(submissionId: string, userId: string, url: string) {
  // A studio code is single-use by construction (redeemCode spends it); a
  // YouTube link has no such owner, so the same video could otherwise
  // validate any number of submissions. Checked first, before spending an
  // API call on metadata a dupe would just throw away — videoId comes
  // straight from the URL's own shape (extractYoutubeVideoId), no network
  // call needed. Canonicalized by video id — not the raw URL text — so
  // youtu.be/X, youtube.com/watch?v=X, and .../shorts/X (all the same
  // upload) can't dodge this by differing in shape. Checked against
  // editCode, which this function is the only writer of for a YouTube match
  // (see the update below) — paired with studioId set, that's "this exact
  // video already validated a different submission."
  const videoId = extractYoutubeVideoId(url);
  const canonicalUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
  if (videoId) {
    const dupe = await prisma.submission.findFirst({
      select: { id: true },
      where: { editCode: canonicalUrl, id: { not: submissionId }, studioId: { not: null } },
    });
    if (dupe) {
      return NextResponse.json(
        { error: "video_already_used", message: "This video has already been used to verify a different submission." },
        { status: 400 },
      );
    }
  }

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

  const [voiceScript, verificationPulled, thumbnailPulled] = await Promise.all([
    transcribeYoutubeUrl(userId, url),
    pullVerificationExport(submissionId, userId, url),
    videoId ? pullYoutubeThumbnail(submissionId, userId, videoId) : Promise.resolve(false),
  ]);

  await prisma.submission.update({
    data: {
      studioId: matched.studioId,
      editCode: canonicalUrl,
      ...(result.description ? { packageDescription: result.description } : {}),
      ...(result.tags.length ? { packageTags: result.tags.join(", ") } : {}),
      ...(result.title ? { packageTitle: result.title } : {}),
      // A matched channel's watermark isn't optional — see the client's
      // editCodeLocked, which forces the toggle on and disables both it and
      // the text field once this lands, alongside the edit-code field itself.
      ...(result.handle ? { watermarkEnabled: true, watermarkText: result.handle } : {}),
      ...(voiceScript ? { voiceScript } : {}),
    },
    where: { id: submissionId },
  });

  return NextResponse.json({
    studioName: matched.studio.name,
    kind: "youtube" as const,
    handle: result.handle,
    packageDescription: result.description,
    packageTags: result.tags.join(", "),
    packageTitle: result.title,
    thumbnailPulled,
    valid: true,
    verificationPulled,
    voiceScript,
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
