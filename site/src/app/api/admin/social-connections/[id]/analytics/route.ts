import { NextResponse } from "next/server";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { YOUTUBE_PLATFORMS } from "@/lib/marketplace/oauth-providers";
import { getValidAccessToken, SocialConnectionError } from "@/lib/marketplace/oauth-token-refresh";
import { getYoutubeChannelAnalytics, YoutubeApiError } from "@/lib/marketplace/youtube-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Super-user only. Channel-level daily stats (views, watch time, likes,
// subscribers gained) for a connected YouTube / YouTube Shorts account —
// yt-analytics.readonly, not per-video, since a connection isn't tied to a
// specific upload.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
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
      { error: "Unsupported platform", message: "Analytics are only wired up for YouTube connections." },
      { status: 400 },
    );
  }

  const daysParam = Number(new URL(request.url).searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 28;

  try {
    const accessToken = await getValidAccessToken(id);
    const rows = await getYoutubeChannelAnalytics({ accessToken, days });
    return NextResponse.json({ rows });
  } catch (error) {
    if (error instanceof SocialConnectionError || error instanceof YoutubeApiError) {
      return NextResponse.json({ error: "Analytics failed", message: error.message }, { status: 502 });
    }
    throw error;
  }
});
