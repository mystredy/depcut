import { NextResponse } from "next/server";

import { presignGet } from "@/cut/server/cloud/r2";
import { transcribeCloud } from "@/cut/server/cloud/transcribe";
import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Fallback transcription source, called when /api/submissions/[id]/edit-code's
// own inline YouTube-URL transcript didn't land but the verification export
// was still pulled in — transcribes that instead (a copy of the published
// video; the Video slot itself is the artist's own manual upload, never
// auto-filled). A signed GET URL for our own R2 object is a more reliable
// source than YouTube's own throttled/expiring format URLs.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    select: {
      assets: { select: { status: true, storageKey: true }, where: { type: "verification" } },
      userId: true,
    },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }
  const verification = submission.assets[0];
  if (!verification?.storageKey || verification.status !== "complete") {
    return NextResponse.json(
      { error: "video_not_ready", message: "The video isn't ready to transcribe yet." },
      { status: 400 },
    );
  }

  const sourceUrl = await presignGet(verification.storageKey);
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
