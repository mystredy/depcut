import { NextResponse } from "next/server";
import { z } from "zod";

import { putObject, submissionVerificationKey, submissionVideoKey } from "@/cut/server/cloud/r2";
import { transcribeCloud } from "@/cut/server/cloud/transcribe";
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

// Fetches a URL into a Buffer bounded by a 20s timeout — shared by the video
// pull and (indirectly) nothing else, but kept as its own helper since it's
// used twice against the same resolved download URL below.
async function fetchBuffer(url: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "video/mp4" };
}

async function upsertAsset(submissionId: string, type: "video" | "verification", key: string, fileName: string) {
  await prisma.submissionAsset.upsert({
    create: { fileName, status: "complete", storageKey: key, submissionId, type },
    update: { error: null, fileName, status: "complete", storageKey: key },
    where: { submissionId_type: { submissionId, type } },
  });
}

// A YouTube link identifies the studio by matching its channel against every
// studio this artist is assigned to — the same result a code would have
// given, arrived at a different way. Also pulls title/description/tags,
// the channel handle (into the watermark field), and — each best-effort,
// since they're slow, can fail independently, and shouldn't block the
// channel match/autofill that already succeeded — the video itself (into
// both the video and verification export slots) and a transcript (into the
// voice-over/script field, via the same hosted transcription Speech to Text
// and the Telegram bot's Transcript button use, metered the same way).
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

  // Best-effort: YouTube's format-resolving call is known to hang in this
  // environment for some videos (see resolveDownloadUrl's own guard) — a
  // failure here just means the video and verification export need a
  // manual upload. Resolved once and reused for transcription below —
  // ElevenLabs fetches sourceUrl itself expecting a direct audio/video
  // file, so a youtube.com page link 400s there; only the resolved direct
  // download URL is fetchable.
  let videoPulled = false;
  let download: Awaited<ReturnType<typeof resolveDownloadUrl>> | null = null;
  try {
    download = await resolveDownloadUrl(result);
    const fetched = download ? await fetchBuffer(download.url) : null;
    if (fetched) {
      const videoKey = submissionVideoKey(userId, submissionId, "video.mp4");
      const verificationKey = submissionVerificationKey(userId, submissionId, "video.mp4");
      await putObject(videoKey, fetched.buffer, fetched.mime);
      await putObject(verificationKey, fetched.buffer, fetched.mime);
      await Promise.all([
        upsertAsset(submissionId, "video", videoKey, "video.mp4"),
        upsertAsset(submissionId, "verification", verificationKey, "video.mp4"),
      ]);
      videoPulled = true;
    }
  } catch (e) {
    console.error("edit-code: youtube video pull failed —", e);
  }

  // Best-effort, same reasoning — and metered against this artist's own
  // inference credits, same as running Speech to Text themselves. Skipped
  // entirely when resolution above failed: there's no direct file URL to
  // hand ElevenLabs, so there's nothing worth spending credits attempting.
  let voiceScript: string | null = null;
  if (download) {
    try {
      const form = new FormData();
      form.append("sourceUrl", download.url);
      const res = await transcribeCloud.transcribe(userId, new Request("http://internal/transcribe", { body: form, method: "POST" }));
      const body = (await res.json().catch(() => null)) as { cues?: { text: string }[] } | null;
      if (res.ok) {
        const transcript = (body?.cues ?? []).map((c) => c.text).join(" ").trim();
        if (transcript) {
          voiceScript = transcript;
          await prisma.submission.update({ data: { voiceScript: transcript }, where: { id: submissionId } });
        }
      }
    } catch (e) {
      console.error("edit-code: youtube transcription failed —", e);
    }
  }

  return NextResponse.json({
    studioName: matched.studio.name,
    kind: "youtube" as const,
    handle: result.handle,
    packageDescription: result.description,
    packageTags: result.tags.join(", "),
    packageTitle: result.title,
    valid: true,
    videoPulled,
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
