import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Mirrors the PostState union from uploades.tsx: only the field matching the
// new state is kept — moving back to "scheduled" clears both.
const updatePostSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("scheduled") }).strict(),
  z.object({ state: z.literal("published"), postUrl: z.string().trim().max(500).nullable() }).strict(),
  z.object({ state: z.literal("failed"), errorMessage: z.string().trim().max(1000).nullable() }).strict(),
]);

// Super-user only: move a Post between scheduled/published/failed — the
// manual stand-in for an actual publish integration reporting back.
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.post.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  const parsed = updatePostSchema.safeParse(await request.json());
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

  const post = await prisma.post.update({
    data: {
      errorMessage: parsed.data.state === "failed" ? parsed.data.errorMessage : null,
      postUrl: parsed.data.state === "published" ? parsed.data.postUrl : null,
      state: parsed.data.state,
    },
    where: { id },
  });

  return NextResponse.json({ post });
});
