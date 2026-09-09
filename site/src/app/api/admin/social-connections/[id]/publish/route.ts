import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { YOUTUBE_PLATFORMS } from "@/lib/marketplace/oauth-providers";
import {
  getValidYoutubeAccessToken,
  publishYoutubeVideo,
  YoutubeApiError,
} from "@/lib/marketplace/youtube-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

const publishSchema = z
  .object({
    videoUrl: z.string().trim().url(),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(5000).optional(),
    privacyStatus: z.enum(["public", "unlisted", "private"]).default("unlisted"),
  })
  .strict();

// Super-user only. Manually publishes a video to a connected YouTube /
// YouTube Shorts destination — the video must already be reachable at a
// URL (an R2 object, or any hosted file), since Vercel's serverless
// request body limit rules out uploading a large file straight through
// this route.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const connection = await prisma.socialConnection.findUnique({ where: { id } });
  if (!connection) return notFoundResponse();

  if (!YOUTUBE_PLATFORMS.includes(connection.platform)) {
    return NextResponse.json(
      { error: "Unsupported platform", message: "Publishing is only wired up for YouTube connections." },
      { status: 400 },
    );
  }

  const parsed = publishSchema.safeParse(await request.json());
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

  try {
    const accessToken = await getValidYoutubeAccessToken(id);
    const published = await publishYoutubeVideo({ accessToken, ...parsed.data });
    return NextResponse.json({ published });
  } catch (error) {
    if (error instanceof YoutubeApiError) {
      return NextResponse.json({ error: "Publish failed", message: error.message }, { status: 502 });
    }
    throw error;
  }
});
