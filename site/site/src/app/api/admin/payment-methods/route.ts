import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { PAYMENT_METHOD_SEED } from "@/lib/marketplace/payment-methods-seed";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds one disabled row per provider on first read.
// Secret fields never leave the server — each becomes a hasX boolean so the
// admin UI can show "configured" without ever re-displaying the value.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const existing = await prisma.paymentMethod.count();
  if (existing === 0) {
    await prisma.paymentMethod.createMany({
      data: PAYMENT_METHOD_SEED.map((provider) => ({ provider })),
      skipDuplicates: true,
    });
  }

  const rows = await prisma.paymentMethod.findMany({ orderBy: { provider: "asc" } });

  return NextResponse.json({
    paymentMethods: rows.map((r) => ({
      enabled: r.enabled,
      hasPublicKey: Boolean(r.publicKey),
      hasSecretKey: Boolean(r.secretKey),
      hasWebhookSecret: Boolean(r.webhookSecret),
      id: r.id,
      merchantId: r.merchantId,
      notes: r.notes,
      provider: r.provider,
      updatedAt: r.updatedAt,
    })),
  });
});
