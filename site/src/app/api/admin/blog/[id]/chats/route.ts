import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// The post editor's chat panel history flyout — metadata only (no `data`,
// which can carry a whole transcript) so listing every thread on a post
// doesn't mean deserializing all of them. See [chatId]/route.ts for the
// full-thread fetch a click on one of these triggers.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id: postId } = await context.params;
  const threads = await prisma.blogChatThread.findMany({
    orderBy: { updatedAt: "desc" },
    select: { createdAt: true, id: true, title: true, updatedAt: true },
    where: { postId },
  });

  return NextResponse.json({ threads });
});
