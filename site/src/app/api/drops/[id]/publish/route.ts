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
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  // Omitted or null publishes immediately; a future timestamp schedules it
  // instead (see dropScheduleSweep.ts). A timestamp that's already passed is
  // treated the same as omitting it — publish now, don't bounce the request.
  scheduledFor: z.string().datetime().nullable().optional(),
  // Destination connection ids to leave out of this one drop's auto-publish
  // fan-out (see DropDialog's per-target toggle) — only read below when
  // publishing right now; a scheduled drop's own future sweep has no way to
  // see this since it isn't persisted anywhere.
  skipConnectionIds: z.array(z.string().trim().min(1)).default([]),
});

// Turns an uploaded draft into a real post (or a scheduled one) — the
// explicit "Post" click in DropDialog, distinct from the upload finishing
// (see complete/route.ts, which only gets a drop to "draft"). An immediate
// publish saves whatever the manager typed, fans out to this studio's
// "Repurpose new posts" workflows, and makes the drop show up as playable
// instead of a draft in the grid. A future scheduledFor instead moves the
// drop to "scheduled" — it stays manager-only (same as a draft) until the
// sweep (dropScheduleSweep.ts) publishes it for real once that time passes.
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

  const scheduledFor = parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null;
  const publishNow = !scheduledFor || scheduledFor.getTime() <= Date.now();

  await prisma.drop.update({
    data: {
      caption: parsed.data.caption || null,
      hashtags: parsed.data.hashtags,
      scheduledFor: publishNow ? null : scheduledFor,
      status: publishNow ? "complete" : "scheduled",
      title: parsed.data.title || null,
      visibility: parsed.data.visibility,
    },
    where: { id },
  });

  if (publishNow) {
    // Fans out to any of this studio's "Repurpose new posts" workflows —
    // see social-workflow-publish.ts. No-ops fast when there are none.
    await enqueueJob(
      "social-workflow-publish",
      { dropId: id, skipConnectionIds: parsed.data.skipConnectionIds },
      userId,
    );
  }

  return NextResponse.json({ ok: true, status: publishNow ? "complete" : "scheduled" });
});
