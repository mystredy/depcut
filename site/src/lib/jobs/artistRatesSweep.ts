import { z } from "zod";

import { defineJob } from "@/lib/jobs/registry";
import { prisma } from "@/lib/prisma";

// Runs on the 1st and 16th (see /api/finance/rates-sweep/run and
// vercel.json) — moves every "Earning" ledger entry from the half-month
// window that closed one full cycle ago out of pending and into available.
// The extra cycle of hold (rather than promoting on the very next payout
// date) is deliberate: a submission approved right before a payout date
// still gets one full cycle to sit before it's cash-out eligible.
//
// On the 1st of month M: promotes earnings from the 1st-15th of month M-1.
// On the 16th of month M: promotes earnings from the 16th-end of month M-1.
// Filtering by status "Pending" makes this naturally idempotent — a rerun
// or overlapping delivery just finds nothing left to promote.
export const artistRatesSweepJob = defineJob(z.object({}).strict(), async () => {
  const now = new Date();
  const day = now.getUTCDate();
  if (day !== 1 && day !== 16) return { promoted: [], reason: "not a payout day" };

  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const windowStart = day === 1 ? new Date(Date.UTC(y, m - 1, 1)) : new Date(Date.UTC(y, m - 1, 16));
  const windowEnd = day === 1 ? new Date(Date.UTC(y, m - 1, 16)) : new Date(Date.UTC(y, m, 1));

  const due = await prisma.financeTransaction.findMany({
    select: { id: true, userId: true, ratesAmount: true },
    where: { type: "Earning", status: "Pending", createdAt: { gte: windowStart, lt: windowEnd } },
  });

  const byUser = new Map<string, { ids: string[]; total: number }>();
  for (const tx of due) {
    // An orphaned ledger row (its user has since been deleted) has nothing
    // to credit — SetNull on FinanceTransaction.userId, not a cascade delete.
    if (!tx.userId) continue;
    const entry = byUser.get(tx.userId) ?? { ids: [], total: 0 };
    entry.ids.push(tx.id);
    entry.total += tx.ratesAmount;
    byUser.set(tx.userId, entry);
  }

  const promoted = await Promise.all(
    Array.from(byUser.entries()).map(async ([userId, { ids, total }]) => {
      await prisma.$transaction([
        prisma.artistRateAccount.upsert({
          create: { available: total, userId },
          update: { available: { increment: total }, pending: { decrement: total } },
          where: { userId },
        }),
        prisma.financeTransaction.updateMany({ data: { status: "Completed" }, where: { id: { in: ids } } }),
      ]);
      return { rates: total, userId };
    }),
  );

  return { promoted, window: { end: windowEnd.toISOString(), start: windowStart.toISOString() } };
});
