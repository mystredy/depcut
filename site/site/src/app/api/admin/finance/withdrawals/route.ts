import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every creator cashout request.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await prisma.withdrawal.findMany({
    include: { user: { select: { displayName: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const withdrawals = rows.map((w) => ({ ...w, userName: w.user.displayName || w.user.name }));

  return NextResponse.json({ withdrawals });
});

// Records a cashout request against a creator's available balance — reserves
// (deducts) the requested amount immediately, same as a real request would.
const createSchema = z
  .object({
    userId: z.string().trim().min(1),
    amountRequested: z.number().int().positive(),
    method: z.string().trim().min(1).max(60),
    destination: z.string().trim().min(1).max(200),
  })
  .strict();

export const POST = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = createSchema.safeParse(await request.json());
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

  const { userId, amountRequested, method, destination } = parsed.data;

  const account = await prisma.creatorRateAccount.upsert({
    create: { userId },
    update: {},
    where: { userId },
  });
  if (account.available < amountRequested) {
    return NextResponse.json(
      { error: "Invalid request", message: "Amount exceeds the creator's available balance." },
      { status: 400 },
    );
  }

  const [settings, exchangeRate] = await Promise.all([
    prisma.financeSettings.upsert({ create: { id: "singleton" }, update: {}, where: { id: "singleton" } }),
    prisma.financeExchangeRate.upsert({ create: { id: "singleton" }, update: {}, where: { id: "singleton" } }),
  ]);

  const grossUsd = amountRequested * exchangeRate.currentRate;
  const processingFee = grossUsd * (settings.processingFeePct / 100);
  const tax = grossUsd * (settings.taxPct / 100);
  const finalAmount = Math.max(0, grossUsd - processingFee - tax);

  const [withdrawal] = await prisma.$transaction([
    prisma.withdrawal.create({
      data: {
        amountRequested,
        destination,
        exchangeRateUsed: exchangeRate.currentRate,
        finalAmount,
        method,
        processingFee,
        userId,
      },
    }),
    prisma.creatorRateAccount.update({
      data: { available: account.available - amountRequested },
      where: { userId },
    }),
  ]);

  return NextResponse.json({ withdrawal });
});
