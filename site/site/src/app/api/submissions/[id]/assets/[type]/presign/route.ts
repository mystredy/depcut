import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import {
  presignPut,
  submissionThumbnailKey,
  submissionVerificationKey,
  submissionVideoKey,
} from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; type: string }> };

const ASSET_TYPES = ["video", "thumbnail", "verification"] as const;
type AssetType = (typeof ASSET_TYPES)[number];

function keyFor(type: AssetType, userId: string, submissionId: string, fileName?: string): string {
  if (type === "thumbnail") return submissionThumbnailKey(userId, submissionId);
  if (type === "video") return submissionVideoKey(userId, submissionId, fileName ?? "video");
  return submissionVerificationKey(userId, submissionId, fileName ?? "verification");
}

const bodySchema = z
  .object({
    fileName: z.string().trim().min(1).max(200).optional(),
    mime: z.string().trim().min(1).max(120),
  })
  .strict();

// Mints a presigned PUT for one asset slot on a submission — the row already
// exists by the time this is ever called (see POST /api/submissions).
// Callable while drafting, and again to retry a failed asset after Submit.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, type: rawType } = await context.params;
  if (!ASSET_TYPES.includes(rawType as AssetType)) {
    return NextResponse.json(
      { error: "invalid_asset_type", message: "Invalid asset type." },
      { status: 400 },
    );
  }
  const type = rawType as AssetType;

  const submission = await prisma.submission.findUnique({
    select: { status: true, userId: true },
    where: { id },
  });
  if (!submission) return notFoundResponse();
  if (submission.userId !== request.donkey.userId) {
    return NextResponse.json({ error: "Forbidden", message: "Forbidden" }, { status: 403 });
  }
  if (submission.status === "submitted") {
    return NextResponse.json(
      { error: "already_submitted", message: "This submission is already submitted." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Invalid request." },
      { status: 400 },
    );
  }

  const key = keyFor(type, submission.userId, id, parsed.data.fileName);
  const url = await presignPut(key, parsed.data.mime);

  await prisma.submissionAsset.upsert({
    create: {
      fileName: parsed.data.fileName,
      status: "uploading",
      storageKey: key,
      submissionId: id,
      type,
    },
    update: { error: null, fileName: parsed.data.fileName, status: "uploading", storageKey: key },
    where: { submissionId_type: { submissionId: id, type } },
  });

  return NextResponse.json({ key, url });
});
