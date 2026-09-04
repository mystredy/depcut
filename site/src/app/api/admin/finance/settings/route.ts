import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// Super-user only. Operational parameters for the Rates economy (withdrawal
// minimums, fees, tax, enabled cashout methods).
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const settings = await prisma.financeSettings.upsert({
    create: { id: SINGLETON_ID },
    update: {},
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});

const updateSchema = z
  .object({
    minWithdrawal: z.number().int().min(0).optional(),
    processingFeePct: z.number().min(0).max(100).optional(),
    taxPct: z.number().min(0).max(100).optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    paymentWindow: z.string().trim().min(1).max(120).optional(),
    payoutCycle: z.string().trim().min(1).max(120).optional(),
    autoTransferDates: z.string().trim().min(1).max(120).optional(),
    methodBank: z.boolean().optional(),
    methodTonWallet: z.boolean().optional(),
    methodStars: z.boolean().optional(),
    methodCrypto: z.boolean().optional(),
  })
  .strict();

export const PATCH = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
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

  const settings = await prisma.financeSettings.upsert({
    create: { id: SINGLETON_ID, ...parsed.data },
    update: parsed.data,
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});
