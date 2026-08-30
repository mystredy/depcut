import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({ enabled: z.boolean() }).strict();

// Super-user only. Toggles whether this model is offered to users.
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.aiModel.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  const parsed = updateSchema.safeParse(await request.json());
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

  const updated = await prisma.aiModel.update({
    data: { enabled: parsed.data.enabled },
    where: { id },
  });

  return NextResponse.json({
    model: {
      enabled: updated.enabled,
      id: updated.id,
      label: updated.label,
      modality: updated.modality,
      modelId: updated.modelId,
      tier: updated.tier,
      updatedAt: updated.updatedAt,
    },
  });
});
