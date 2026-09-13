import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { validationErrorResponse } from "@/lib/inference/responses";
import { getStudioMembership } from "@/lib/studio/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Hashtags arrive as free text ("#dance #fun" or "dance, fun") and get
// split/cleaned here — the client sends one string, not a pre-split array,
// so this is the one place that decides what counts as a tag.
const hashtagsSchema = z
  .string()
  .trim()
  .max(280)
  .optional()
  .transform((raw) =>
    (raw ?? "")
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean)
      .slice(0, 30)
  );

const createDropSchema = z.object({
  title: z.string().trim().max(100).nullable().optional(),
  caption: z.string().trim().max(280).nullable().optional(),
  hashtags: hashtagsSchema,
  projectId: z.string().trim().min(1).max(100).nullable().optional(),
  studioId: z.string().trim().min(1),
});

// A draft row, same shape as marketplace submissions' "New Submit": create
// the row first so the presign/complete steps that follow have a real id to
// key R2 objects by, rather than a client-generated draft id.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const parsed = createDropSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const membership = await getStudioMembership(request.depcut.userId, parsed.data.studioId);
  if (!membership) return notFoundResponse();

  const drop = await prisma.drop.create({
    data: {
      title: parsed.data.title || null,
      caption: parsed.data.caption || null,
      hashtags: parsed.data.hashtags,
      projectId: parsed.data.projectId || null,
      studioId: parsed.data.studioId,
      userId: request.depcut.userId,
    },
    select: { id: true },
  });

  return NextResponse.json({ drop });
});
