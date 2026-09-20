import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { extractFromUrl, UrlImportError } from "@/lib/marketplace/url-import";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ url: z.string().trim().url() });

// Pulls title/description/tags from a YouTube, TikTok, or Snapchat link —
// see url-import.ts. Metadata only; nothing here downloads or posts a
// video.
export const POST = withDepCutAuth(async (request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", message: "Paste a valid video URL." }, { status: 400 });
  }

  try {
    const result = await extractFromUrl(parsed.data.url);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UrlImportError) {
      return NextResponse.json({ error: "import_failed", message: e.message }, { status: 422 });
    }
    throw e;
  }
});
