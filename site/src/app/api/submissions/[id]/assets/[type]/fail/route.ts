import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { failSubmissionAsset } from "@/lib/marketplace/submission-promotion";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; type: string }> };

const ASSET_TYPES = ["video", "thumbnail", "verification"] as const;
const bodySchema = z.object({ error: z.string().trim().max(500).optional() }).strict();

// The client-side upload itself failed (network error, non-2xx PUT) before
// it ever got to /complete. Marks the asset failed and, if the creator had
// already asked to submit, fails the submission too.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, type: rawType } = await context.params;
  if (!ASSET_TYPES.includes(rawType as (typeof ASSET_TYPES)[number])) {
    return NextResponse.json(
      { error: "invalid_asset_type", message: "Invalid asset type." },
      { status: 400 },
    );
  }

  const submission = await prisma.submission.findUnique({
    select: { userId: true },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Invalid request." },
      { status: 400 },
    );
  }

  await failSubmissionAsset(id, rawType, parsed.data.error ?? "Upload failed.");
  return NextResponse.json({ ok: true });
});
