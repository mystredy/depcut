import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Marks every Pending/Approved withdrawal as Paid in one pass and logs a
// transaction for each — the Payout Queue's "Bulk Pay All Queued" action.
export const POST = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const queued = await prisma.withdrawal.findMany({
    include: { user: { select: { displayName: true, name: true } } },
    where: { status: { in: ["Pending", "Approved"] } },
  });

  if (queued.length === 0) {
    return NextResponse.json({ paidCount: 0 });
  }

  await prisma.$transaction([
    prisma.withdrawal.updateMany({
      data: { status: "Paid" },
      where: { id: { in: queued.map((w) => w.id) } },
    }),
    prisma.financeTransaction.createMany({
      data: queued.map((w) => ({
        amount: w.finalAmount,
        details: `Bulk payout processed via ${w.method} to ${w.destination}`,
        ratesAmount: w.amountRequested,
        status: "Completed",
        type: "Withdrawal",
        userId: w.userId,
        userName: w.user.displayName || w.user.name,
      })),
    }),
  ]);

  return NextResponse.json({ paidCount: queued.length });
});
