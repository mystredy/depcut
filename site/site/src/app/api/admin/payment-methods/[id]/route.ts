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

const updateSchema = z
  .object({
    enabled: z.boolean().optional(),
    publicKey: z.string().trim().max(500).optional(),
    secretKey: z.string().trim().max(500).optional(),
    merchantId: z.string().trim().max(200).optional(),
    webhookSecret: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

// Super-user only. Secret-like fields (publicKey/secretKey/webhookSecret)
// only update when a non-empty value is sent — leaving the input blank in
// the UI means "don't touch this", not "clear it". merchantId/notes clear on
// an empty string like a normal field.
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.paymentMethod.findUnique({ select: { id: true }, where: { id } });
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

  const { enabled, publicKey, secretKey, webhookSecret, merchantId, notes } = parsed.data;

  await prisma.paymentMethod.update({
    data: {
      enabled,
      ...(publicKey ? { publicKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(webhookSecret ? { webhookSecret } : {}),
      ...(merchantId !== undefined ? { merchantId: merchantId || null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
    where: { id },
  });

  const updated = await prisma.paymentMethod.findUniqueOrThrow({ where: { id } });

  return NextResponse.json({
    paymentMethod: {
      enabled: updated.enabled,
      hasPublicKey: Boolean(updated.publicKey),
      hasSecretKey: Boolean(updated.secretKey),
      hasWebhookSecret: Boolean(updated.webhookSecret),
      id: updated.id,
      merchantId: updated.merchantId,
      notes: updated.notes,
      provider: updated.provider,
      updatedAt: updated.updatedAt,
    },
  });
});
