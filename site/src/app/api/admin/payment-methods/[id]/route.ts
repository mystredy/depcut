import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { setEnvVars } from "@/lib/env-file";
import {
  PAYMENT_METHOD_ENV_VARS,
  type PaymentProvider,
} from "@/lib/marketplace/payment-methods-seed";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    enabled: z.boolean().optional(),
    publicKey: z.string().trim().max(500).optional(),
    secretKey: z.string().trim().max(500).optional(),
    payoutKey: z.string().trim().max(500).optional(),
    merchantId: z.string().trim().max(200).optional(),
    webhookSecret: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

// Super-user only. Secret-like fields (publicKey/secretKey/webhookSecret)
// only update when a non-empty value is sent — leaving the input blank in
// the UI means "don't touch this", not "clear it". merchantId/notes clear on
// an empty string like a normal field.
export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.paymentMethod.findUnique({
    select: { id: true, provider: true },
    where: { id },
  });
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

  const { enabled, publicKey, secretKey, payoutKey, webhookSecret, merchantId, notes } = parsed.data;

  await prisma.paymentMethod.update({
    data: {
      enabled,
      ...(publicKey ? { publicKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(payoutKey ? { payoutKey } : {}),
      ...(webhookSecret ? { webhookSecret } : {}),
      ...(merchantId !== undefined ? { merchantId: merchantId || null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
    where: { id },
  });

  // Best-effort mirror into this server's local .env, for whichever fields
  // this provider has a known env var for — see PAYMENT_METHOD_ENV_VARS.
  // Same non-fatal pattern as the API Integrations panel: a real production
  // host's env usually isn't a writable file, so failures here are swallowed.
  // Batched into one setEnvVars call — writing each field with its own
  // parallel setEnvVar would race on the same file and lose updates.
  const envVars = PAYMENT_METHOD_ENV_VARS[existing.provider as PaymentProvider];
  if (envVars) {
    const entries: Record<string, string> = {};
    if (publicKey && envVars.publicKey) entries[envVars.publicKey] = publicKey;
    if (secretKey && envVars.secretKey) entries[envVars.secretKey] = secretKey;
    if (payoutKey && envVars.payoutKey) entries[envVars.payoutKey] = payoutKey;
    if (webhookSecret && envVars.webhookSecret) entries[envVars.webhookSecret] = webhookSecret;
    if (merchantId && envVars.merchantId) entries[envVars.merchantId] = merchantId;
    await setEnvVars(entries).catch(() => {});
  }

  const updated = await prisma.paymentMethod.findUniqueOrThrow({ where: { id } });

  return NextResponse.json({
    paymentMethod: {
      enabled: updated.enabled,
      hasPayoutKey: Boolean(updated.payoutKey),
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
