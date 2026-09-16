import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { YOUTUBE_PLATFORMS } from "@/lib/marketplace/oauth-providers";
import { getValidAccessToken, SocialConnectionError } from "@/lib/marketplace/oauth-token-refresh";
import { getYoutubeChannelAnalytics, YoutubeApiError } from "@/lib/marketplace/youtube-api";
import { prisma } from "@/lib/prisma";
import { getStudioMembership } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; connectionId: string }> };

// Managers only. Same channel-level daily stats as the admin route — see
// /api/admin/social-connections/[id]/analytics — scoped to a connection
// this studio actually owns instead of requiring super-user access.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, connectionId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const connection = await prisma.socialConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.studioId !== id) return notFoundResponse();

  if (!YOUTUBE_PLATFORMS.includes(connection.platform)) {
    return NextResponse.json(
      { error: "Unsupported platform", message: "Analytics are only wired up for YouTube connections." },
      { status: 400 },
    );
  }

  const daysParam = Number(new URL(request.url).searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 28;

  try {
    const accessToken = await getValidAccessToken(connectionId);
    const rows = await getYoutubeChannelAnalytics({ accessToken, days });
    return NextResponse.json({ rows });
  } catch (error) {
    if (error instanceof SocialConnectionError || error instanceof YoutubeApiError) {
      return NextResponse.json({ error: "Analytics failed", message: error.message }, { status: 502 });
    }
    throw error;
  }
});
