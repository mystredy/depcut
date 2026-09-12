import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { validationErrorResponse } from "@/lib/inference/responses";
import { getStudioMembership } from "@/lib/space/studio-access";
import { SPACE_STORAGE_LIMIT_BYTES, spaceStorageUsedBytes } from "@/lib/space/storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET lists this account's own posts (newest first) plus their storage
// usage against the flat 10GB quota — one round trip for what My Space's
// Posts tab needs. There's no public feed here yet; Showcase reads its own
// seed list until a real feed exists (see showcase/page.tsx's own note).
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const userId = request.depcut.userId;
  const [posts, usedBytes] = await Promise.all([
    prisma.spacePost.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        caption: true,
        createdAt: true,
        error: true,
        fileName: true,
        id: true,
        sizeBytes: true,
        status: true,
        thumbnailKey: true,
      },
      where: { userId },
    }),
    spaceStorageUsedBytes(userId),
  ]);

  return NextResponse.json({
    limitBytes: SPACE_STORAGE_LIMIT_BYTES,
    posts,
    usedBytes,
  });
});

const createPostSchema = z.object({
  caption: z.string().trim().max(280).nullable().optional(),
  projectId: z.string().trim().min(1).max(100).nullable().optional(),
  // Omitted/null posts to the author's own personal Space; set posts to
  // that Studio's feed instead — the author must manage it.
  studioId: z.string().trim().min(1).nullable().optional(),
});

// A draft row, same shape as marketplace submissions' "New Submit": create
// the row first so the presign/complete steps that follow have a real id to
// key R2 objects by, rather than a client-generated draft id.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const parsed = createPostSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  if (parsed.data.studioId) {
    const membership = await getStudioMembership(request.depcut.userId, parsed.data.studioId);
    if (!membership) return notFoundResponse();
  }

  const post = await prisma.spacePost.create({
    data: {
      studioId: parsed.data.studioId || null,
      caption: parsed.data.caption || null,
      projectId: parsed.data.projectId || null,
      userId: request.depcut.userId,
    },
    select: { id: true },
  });

  return NextResponse.json({ post });
});
