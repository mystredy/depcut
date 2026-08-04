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

const updateSchema = z.object({ status: z.enum(["Paid", "Rejected"]) }).strict();

export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.giveawayPayment.findUnique({
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

  const admin = await prisma.user.findUnique({
    select: { displayName: true, name: true },
    where: { id: request.donkey.userId },
  });
  const userName = existing.user.displayName || existing.user.name;
  const { status } = parsed.data;

  const shouldLogTransaction = status === "Paid" && existing.status !== "Paid";

  const [giveaway] = await prisma.$transaction([
    prisma.giveawayPayment.update({
      data: {
        paidBy: status === "Paid" ? admin?.displayName || admin?.name || "Admin" : existing.paidBy,
        paidDate: status === "Paid" ? new Date() : existing.paidDate,
        status,
      },
      where: { id },
    }),
    ...(shouldLogTransaction
      ? [
          prisma.financeTransaction.create({
            data: {
              details: `Giveaway prize payout: ${existing.reward} (${existing.topPosition})`,
              status: "Completed",
              type: "Giveaway",
              userId: existing.userId,
              userName,
            },
          }),
        ]
      : []),
    prisma.notification.create(
      notifyUser({
        body:
          status === "Paid"
            ? `Your ${existing.topPosition} prize (${existing.reward}) has been paid out.`
            : `Your ${existing.topPosition} giveaway payout was rejected.`,
        link: "/app/settings/payouts",
        title: status === "Paid" ? "Giveaway prize paid" : "Giveaway payout rejected",
        userId: existing.userId,
      }),
    ),
  ]);

  return NextResponse.json({ giveaway });
});
