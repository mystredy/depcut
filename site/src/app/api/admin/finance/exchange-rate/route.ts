import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// Super-user only. The live 1-Rate-to-USD conversion, plus its change log.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const exchangeRate = await prisma.financeExchangeRate.upsert({
    create: { id: SINGLETON_ID },
    update: {},
    where: { id: SINGLETON_ID },
  });
  const history = await prisma.financeExchangeRateHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return NextResponse.json({ exchangeRate, history });
});

const updateSchema = z
  .object({
    rate: z.number().positive(),
    effectiveDate: z.string().trim().min(1).max(40),
  })
  .strict();

export const PATCH = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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

  const admin = await prisma.user.findUnique({
    select: { displayName: true, name: true },
    where: { id: request.donkey.userId },
  });
  const authorName = admin?.displayName || admin?.name || "Admin";

  const { rate, effectiveDate } = parsed.data;
  const [exchangeRate] = await prisma.$transaction([
    prisma.financeExchangeRate.upsert({
      create: { currentRate: rate, effectiveDate, id: SINGLETON_ID },
      update: { currentRate: rate, effectiveDate },
      where: { id: SINGLETON_ID },
    }),
    prisma.financeExchangeRateHistory.create({
      data: { authorName, effectiveDate: parsed.data.effectiveDate, rate: parsed.data.rate },
    }),
  ]);

  const history = await prisma.financeExchangeRateHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return NextResponse.json({ exchangeRate, history });
});
