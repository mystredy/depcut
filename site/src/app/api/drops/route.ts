import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { validationErrorResponse } from "@/lib/inference/responses";
import { getStudioMembership } from "@/lib/studio/access";
import { SPACE_STORAGE_LIMIT_BYTES, spaceStorageUsedBytes } from "@/lib/studio/storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Storage usage against the flat 10GB-per-account quota, summed across
// every studio the account has dropped to. Each studio's own drop feed is
// GET /api/studios/[id]/drops — there's no flat cross-studio list anymore.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const usedBytes = await spaceStorageUsedBytes(request.depcut.userId);
  return NextResponse.json({
    limitBytes: SPACE_STORAGE_LIMIT_BYTES,
    usedBytes,
  });
});

const createDropSchema = z.object({
  caption: z.string().trim().max(280).nullable().optional(),
  projectId: z.string().trim().min(1).max(100).nullable().optional(),
  studioId: z.string().trim().min(1),
});

// A draft row, same shape as marketplace submissions' "New Submit": create
// the row first so the presign/complete steps that follow have a real id to
// key R2 objects by, rather than a client-generated draft id.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const parsed = createDropSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const membership = await getStudioMembership(request.depcut.userId, parsed.data.studioId);
  if (!membership) return notFoundResponse();

  const drop = await prisma.drop.create({
    data: {
      caption: parsed.data.caption || null,
      projectId: parsed.data.projectId || null,
      studioId: parsed.data.studioId,
      userId: request.depcut.userId,
    },
    select: { id: true },
  });

  return NextResponse.json({ drop });
});
