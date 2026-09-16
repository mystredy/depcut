import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { YOUTUBE_PLATFORMS } from "@/lib/marketplace/oauth-providers";
import { getValidAccessToken, SocialConnectionError } from "@/lib/marketplace/oauth-token-refresh";
import { getYoutubeVideoStats, YoutubeApiError } from "@/lib/marketplace/youtube-api";
import { prisma } from "@/lib/prisma";
import { getStudioMembership } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; dropId: string }> };

// Managers only. A drop's own view/like/comment totals off the platform it
// was actually published to — see DropPublication (written by
// social-workflow-publish.ts). Only YouTube exposes per-video statistics
// through its public API today; the other platforms have nothing
// equivalent to call.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, dropId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const drop = await prisma.drop.findUnique({
    select: {
      studioId: true,
      publications: {
        select: { destinationAccountName: true, destinationConnectionId: true, externalPostId: true, platform: true },
        where: { status: "success" },
      },
    },
    where: { id: dropId },
  });
  if (!drop || drop.studioId !== id) return notFoundResponse();

  const publication = drop.publications.find(
    (p) => YOUTUBE_PLATFORMS.includes(p.platform) && p.externalPostId,
  );
  if (!publication?.externalPostId) {
    return NextResponse.json(
      { error: "Unsupported platform", message: "Analytics are only available for a video published to YouTube." },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getValidAccessToken(publication.destinationConnectionId);
    const stats = await getYoutubeVideoStats({ accessToken, videoId: publication.externalPostId });
    return NextResponse.json({ accountName: publication.destinationAccountName, ...stats });
  } catch (error) {
    if (error instanceof SocialConnectionError || error instanceof YoutubeApiError) {
      return NextResponse.json({ error: "Analytics failed", message: error.message }, { status: 502 });
    }
    throw error;
  }
});
