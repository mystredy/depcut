import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { notifyUser } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({ status: z.enum(["Approved", "Paid", "Rejected"]) }).strict();

export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.withdrawal.findUnique({
    include: { user: { select: { displayName: true, name: true } } },
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

  const userName = existing.user.displayName || existing.user.name;
  const { status } = parsed.data;

  // Rejecting returns the reserved Rates to the creator's available balance.
  if (status === "Rejected" && existing.status !== "Rejected" && existing.status !== "Paid") {
    await prisma.creatorRateAccount.update({
      data: { available: { increment: existing.amountRequested } },
      where: { userId: existing.userId },
    });
  }

  const shouldLogTransaction = status === "Paid" && existing.status !== "Paid";
  const notifyBody: Record<typeof status, string> = {
    Approved: `Your withdrawal of ${existing.amountRequested.toLocaleString()} Rates was approved and is being processed.`,
    Paid: `${existing.finalAmount.toFixed(2)} was sent via ${existing.method} to ${existing.destination}.`,
    Rejected: `Your withdrawal request for ${existing.amountRequested.toLocaleString()} Rates was rejected. The Rates were returned to your available balance.`,
  };

  const [withdrawal] = await prisma.$transaction([
    prisma.withdrawal.update({ data: { status }, where: { id } }),
    ...(shouldLogTransaction
      ? [
          prisma.financeTransaction.create({
            data: {
              amount: existing.finalAmount,
              details: `Paid withdrawal via ${existing.method} to ${existing.destination}`,
              ratesAmount: existing.amountRequested,
              status: "Completed",
              type: "Withdrawal",
              userId: existing.userId,
              userName,
            },
          }),
        ]
      : []),
    prisma.notification.create(
      notifyUser({
        body: notifyBody[status],
        link: "/app/settings/payouts",
        title: `Withdrawal ${status.toLowerCase()}`,
        userId: existing.userId,
      }),
    ),
  ]);

  return NextResponse.json({ withdrawal });
});
