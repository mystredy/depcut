import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { hashtagsSchema } from "@/app/api/drops/schemas";
import { validationErrorResponse } from "@/lib/inference/responses";
import { enqueueJob } from "@/lib/jobs/queue";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const publishSchema = z.object({
  title: z.string().trim().max(100).nullable().optional(),
  caption: z.string().trim().max(280).nullable().optional(),
  hashtags: hashtagsSchema,
});

// Turns an uploaded draft into a real post — the explicit "Post" click in
// DropDialog, distinct from the upload finishing (see complete/route.ts,
// which only gets a drop to "draft"). Saves whatever the manager typed
// while the upload was running, then fans out to this studio's "Repurpose
// new posts" workflows and makes the drop show up as playable instead of a
// draft in the grid.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const userId = request.depcut.userId;

  const drop = await prisma.drop.findUnique({
    select: { status: true, userId: true },
    where: { id },
  });
  if (!drop) return notFoundResponse();
  if (drop.userId !== userId) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }
  if (drop.status !== "draft") {
    return NextResponse.json(
      { error: "not_ready", message: "This drop hasn't finished uploading yet." },
      { status: 400 },
    );
  }

  const parsed = publishSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  await prisma.drop.update({
    data: {
      caption: parsed.data.caption || null,
      hashtags: parsed.data.hashtags,
      status: "complete",
      title: parsed.data.title || null,
    },
    where: { id },
  });

  // Fans out to any of this studio's "Repurpose new posts" workflows — see
  // social-workflow-publish.ts. No-ops fast when there are none.
  await enqueueJob("social-workflow-publish", { dropId: id }, userId);

  return NextResponse.json({ ok: true });
});
