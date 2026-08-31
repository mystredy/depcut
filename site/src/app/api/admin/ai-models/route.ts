import { NextResponse } from "next/server";
import { z } from "zod";

import { aiModelKey } from "@/lib/ai-models-seed";
import { listAiModels } from "@/lib/ai-models";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds via listAiModels() — see that file's header.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await listAiModels();

  return NextResponse.json({
    models: rows.map((r) => ({
      enabled: r.enabled,
      id: r.id,
      label: r.label,
      modality: r.modality,
      modelId: r.modelId,
      tier: r.tier,
      updatedAt: r.updatedAt,
    })),
  });
});

const createModelSchema = z
  .object({
    modality: z.enum(["chat", "image", "video", "audio"]),
    // Matches a real picker's own tier id (VideoTier/ImageTier) when this is
    // meant to actually appear there — see the route's own comment below.
    tier: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only."),
    label: z.string().trim().min(1).max(200),
    modelId: z.string().trim().min(1).max(300),
    enabled: z.boolean().optional(),
  })
  .strict();

// Super-user only: register a model this codebase doesn't already list in
// videoModels.ts/imageModels.ts/gemini-models.ts. Recording it here alone
// does not make it selectable or usable — the video/image pickers only ever
// show tiers that already exist in those client registries (see
// aiModelAvailability.ts), and every generate request is rejected unless its
// model id has a configured price in provider-pricing.ts. This row is what
// an admin sees and can flip on; wiring a genuinely new model into an actual
// picker and pricing it is still a code change.
export const POST = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = createModelSchema.safeParse(await request.json());
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

  const { modality, tier, label, modelId, enabled } = parsed.data;
  const key = aiModelKey(modality, tier);

  const existing = await prisma.aiModel.findUnique({ select: { id: true }, where: { key } });
  if (existing) {
    return NextResponse.json(
      { error: "Invalid request", issues: [{ message: "That tier already exists for this modality.", path: "tier" }] },
      { status: 400 },
    );
  }

  const model = await prisma.aiModel.create({
    data: { enabled: enabled ?? true, key, label, modality, modelId, tier },
  });

  return NextResponse.json({
    model: {
      enabled: model.enabled,
      id: model.id,
      label: model.label,
      modality: model.modality,
      modelId: model.modelId,
      tier: model.tier,
      updatedAt: model.updatedAt,
    },
  });
});
