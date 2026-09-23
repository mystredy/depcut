import { NextResponse } from "next/server";

import { presignGet } from "@/cut/server/cloud/r2";
import { transcribeCloud } from "@/cut/server/cloud/transcribe";
import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Called once the client sees the submission_youtube render-worker job land
// (see /api/submissions/[id]/edit-code and src/cut/worker/
// submissionYoutubeJob.ts) — transcribes the video that job just uploaded to
// R2. Split out from the job itself: transcription bills the artist's
// inference credits (@/lib/credits/inference), which needs Next's request
// context and isn't available in the worker's plain Node process. A signed
// GET URL for our own R2 object is also a more reliable transcription
// source than YouTube's own throttled/expiring format URLs.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    select: {
      assets: { select: { status: true, storageKey: true }, where: { type: "video" } },
      userId: true,
    },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }
  const video = submission.assets[0];
  if (!video?.storageKey || video.status !== "complete") {
    return NextResponse.json(
      { error: "video_not_ready", message: "The video isn't ready to transcribe yet." },
      { status: 400 },
    );
  }

  const sourceUrl = await presignGet(video.storageKey);
  const form = new FormData();
  form.append("sourceUrl", sourceUrl);
  const res = await transcribeCloud.transcribe(
    submission.userId,
    new Request("http://internal/transcribe", { body: form, method: "POST" }),
  );
  const body = (await res.json().catch(() => null)) as { cues?: { text: string }[]; message?: string } | null;
  if (!res.ok) {
    return NextResponse.json({ message: body?.message ?? "Couldn't transcribe that video.", voiceScript: null });
  }

  const transcript = (body?.cues ?? []).map((c) => c.text).join(" ").trim();
  if (transcript) await prisma.submission.update({ data: { voiceScript: transcript }, where: { id } });

  return NextResponse.json({ voiceScript: transcript || null });
});
