import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { draftThumbnailKey, presignPut } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ draftId: string }> };

const draftIdSchema = z.string().trim().regex(/^[a-zA-Z0-9-]{1,80}$/);
const bodySchema = z.object({ mime: z.enum(["image/webp", "image/jpeg", "image/png"]) }).strict();

// Mints a presigned PUT for a draft's thumbnail, before any Submission row
// exists — uploads start the instant a file is picked. The draftId is
// client-generated (crypto.randomUUID()); ownership rides the userId baked
// into the key rather than a database row. A draft that's never submitted
// is swept later by /api/admin/marketplace/sweep-drafts.
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

  const key = draftThumbnailKey(request.donkey.userId, draftId.data);
  const url = await presignPut(key, parsed.data.mime);
  return NextResponse.json({ key, url });
});
