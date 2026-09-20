import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { createScriptGeneration, listScriptGenerations } from "@/lib/scripts/db";

export const dynamic = "force-dynamic";

// The signed-in user's own durable Scripting history.
export const GET = withDepCutAuth(async (request) => {
  const scripts = await listScriptGenerations(request.depcut.userId);
  return NextResponse.json({ scripts });
});

const createSchema = z
  .object({
    topic: z.string().trim().min(1).max(500),
    duration: z.string().max(50),
    platform: z.string().max(50),
    tone: z.string().max(200).optional(),
    status: z.enum(["succeeded", "failed"]),
    script: z.string().max(50_000).optional(),
    errorMessage: z.string().max(2_000).optional(),
  })
  .strict()
  .refine((data) => (data.status === "succeeded" ? !!data.script : !!data.errorMessage), {
    message: "script is required when succeeded, errorMessage is required when failed",
    path: ["script"],
  });

// Called once, right after a Scripting run finishes client-side (see
// cut/lib/scriptPersist.ts).
export const POST = withDepCutAuth(async (request) => {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  const row = await createScriptGeneration(
    body.status === "succeeded"
      ? {
          duration: body.duration,
          platform: body.platform,
          script: body.script!,
          status: "succeeded",
          tone: body.tone,
          topic: body.topic,
          userId: request.depcut.userId,
        }
      : {
          duration: body.duration,
          errorMessage: body.errorMessage!,
          platform: body.platform,
          status: "failed",
          tone: body.tone,
          topic: body.topic,
          userId: request.depcut.userId,
        },
  );
  return NextResponse.json(row, { status: 201 });
});
