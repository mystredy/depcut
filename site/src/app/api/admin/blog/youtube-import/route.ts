import { NextResponse } from "next/server";

import { transcribeCloud } from "@/cut/server/cloud/transcribe";
import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { detectUrlImportPlatform, extractFromUrl, UrlImportError } from "@/lib/marketplace/url-import";

export const dynamic = "force-dynamic";
// Transcription (below) can take a while on top of the metadata fetch —
// matches the submissions edit-code route's own budget for the same call.
export const maxDuration = 120;

// A full transcript can run to thousands of words on a long video; capped so
// one import can't balloon the chat agent's context.
const MAX_TRANSCRIPT_CHARS = 12_000;

// ElevenLabs Scribe transcribes straight from a YouTube URL, same as
// /api/submissions/[id]/edit-code's own inline transcription. Best-effort:
// any failure (not configured, YouTube-side hiccup, timeout) just means no
// transcript, not a failed import — title/description/tags alone are still
// useful to write from. Billed against the calling admin's own inference
// credits, unlike the rest of this chat tool's unbilled text generation.
async function transcribeYoutubeUrl(userId: string, url: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("sourceUrl", url);
    const res = await Promise.race([
      transcribeCloud.transcribe(userId, new Request("http://internal/transcribe", { body: form, method: "POST" })),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 60_000)),
    ]);
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { cues?: { text: string }[] } | null;
    const transcript = (body?.cues ?? []).map((c) => c.text).join(" ").trim();
    return transcript || null;
  } catch (e) {
    console.error("[blog youtube-import] transcription failed —", e instanceof Error ? e.message : e);
    return null;
  }
}

// Fetches a YouTube video's metadata and (best-effort) transcript for the
// blog chat agent's import_youtube tool — read-only, the agent still has to
// call update_content/set_title/etc. itself to actually write the post.
export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url is required." }, { status: 400 });
  if (detectUrlImportPlatform(url) !== "youtube") {
    return NextResponse.json({ error: "That doesn't look like a YouTube video link." }, { status: 400 });
  }

  let meta;
  try {
    meta = await extractFromUrl(url);
  } catch (e) {
    const message = e instanceof UrlImportError ? e.message : "Couldn't read that YouTube video.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const transcript = await transcribeYoutubeUrl(request.depcut.userId, url);

  return NextResponse.json({
    description: meta.description,
    tags: meta.tags,
    thumbnailUrl: meta.thumbnailUrl,
    title: meta.title,
    transcript: transcript ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) : null,
  });
});
