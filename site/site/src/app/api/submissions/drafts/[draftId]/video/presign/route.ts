import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { draftVideoKey, presignPut } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ draftId: string }> };

const draftIdSchema = z.string().trim().regex(/^[a-zA-Z0-9-]{1,80}$/);
const bodySchema = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    mime: z.string().trim().min(1).max(120),
  })
  .strict();

// Mints a presigned PUT for a draft's main video, before any Submission row
// exists — see the thumbnail presign route in this same drafts/ tree for why.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { draftId: rawDraftId } = await context.params;
  const draftId = draftIdSchema.safeParse(rawDraftId);
  if (!draftId.success) {
    return NextResponse.json({ error: "Invalid draft id" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const key = draftVideoKey(request.donkey.userId, draftId.data, parsed.data.fileName);
  const url = await presignPut(key, parsed.data.mime);
  return NextResponse.json({ key, url });
});
