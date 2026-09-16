import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { publishToConnection, PublishError } from "@/lib/marketplace/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

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
    const published = await publishToConnection(id, parsed.data);
    return NextResponse.json({ published });
  } catch (error) {
    if (error instanceof PublishError) {
      const status = error.message === "Connection not found." ? 404 : 502;
      if (status === 404) return notFoundResponse();
      return NextResponse.json({ error: "Publish failed", message: error.message }, { status });
    }
    throw error;
  }
});
