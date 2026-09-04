import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const platforms = [
  "tiktok",
  "youtube",
  "facebook",
  "instagram",
  "threads",
  "snapchat",
  "x",
] as const;

const createPostSchema = z
  .object({
    platform: z.enum(platforms),
    text: z.string().trim().max(2000).optional(),
    mediaUrls: z.string().trim().max(2000).optional(),
    shortLink: z.boolean().default(false),
  })
  .strict();

// Super-user only: record a new per-platform post under an Upload — the
// manual stand-in for an actual publish integration. Starts "scheduled";
// PATCH /api/admin/posts/[id] moves it to published or failed.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const upload = await prisma.upload.findUnique({ select: { id: true }, where: { id } });
  if (!upload) {
    return notFoundResponse();
  }

  const parsed = createPostSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const post = await prisma.post.create({
    data: { ...parsed.data, uploadId: id },
  });

  return NextResponse.json({ post });
});
