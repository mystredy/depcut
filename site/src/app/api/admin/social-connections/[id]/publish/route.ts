import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { PUBLISHABLE_PLATFORMS } from "@/lib/marketplace/oauth-providers";
import { getValidAccessToken, SocialConnectionError } from "@/lib/marketplace/oauth-token-refresh";
import { publishTiktokVideo, TiktokApiError } from "@/lib/marketplace/tiktok-api";
import { publishXPost, XApiError } from "@/lib/marketplace/x-api";
import { publishYoutubeVideo, YoutubeApiError } from "@/lib/marketplace/youtube-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

// A superset of every platform's fields — the route picks what each
// platform actually needs and 400s if something required is missing for
// that platform, rather than every platform sharing one rigid shape.
const publishSchema = z
  .object({
    videoUrl: z.string().trim().url().optional(),
    title: z.string().trim().min(1).max(280),
    description: z.string().trim().max(5000).optional(),
    privacyStatus: z.enum(["public", "unlisted", "private"]).default("unlisted"),
  })
  .strict();

// Super-user only. Manually publishes to a connected destination — the
// video (where required) must already be reachable at a URL (an R2
// object, or any hosted file), since Vercel's serverless request body
// limit rules out uploading a large file straight through this route.
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

  if (!PUBLISHABLE_PLATFORMS.includes(connection.platform)) {
    return NextResponse.json(
      {
        error: "Unsupported platform",
        message: `Publishing isn't wired up for ${connection.platform} connections yet.`,
      },
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
  const { videoUrl, title, description, privacyStatus } = parsed.data;

  try {
    const accessToken = await getValidAccessToken(id);

    if (connection.platform === "youtube" || connection.platform === "youtube_shorts") {
      if (!videoUrl) {
        return NextResponse.json(
          { error: "Invalid request", message: "videoUrl is required for YouTube." },
          { status: 400 },
        );
      }
      const published = await publishYoutubeVideo({ accessToken, description, privacyStatus, title, videoUrl });
      return NextResponse.json({ published });
    }

    if (connection.platform === "tiktok") {
      if (!videoUrl) {
        return NextResponse.json(
          { error: "Invalid request", message: "videoUrl is required for TikTok." },
          { status: 400 },
        );
      }
      const published = await publishTiktokVideo({ accessToken, caption: title, videoUrl });
      return NextResponse.json({ published });
    }

    if (connection.platform === "x") {
      const published = await publishXPost({ accessToken, text: title, videoUrl });
      return NextResponse.json({ published });
    }

    return NextResponse.json(
      { error: "Unsupported platform", message: `No publish handler wired for ${connection.platform}.` },
      { status: 400 },
    );
  } catch (error) {
    if (
      error instanceof SocialConnectionError ||
      error instanceof YoutubeApiError ||
      error instanceof TiktokApiError ||
      error instanceof XApiError
    ) {
      return NextResponse.json({ error: "Publish failed", message: error.message }, { status: 502 });
    }
    throw error;
  }
});
