import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { notifyUser } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

const updateSchema = z
  .object({ status: z.enum(["Approved", "Rejected"]), reviewNote: z.string().trim().max(1_000).optional() })
  .strict();

const NOTIFY_BODY: Record<"Approved" | "Rejected", string> = {
  Approved: "You're a creator now — check Payouts in your account menu to set up cashouts.",
  Rejected: "Your creator application wasn't approved this time.",
};

// Approve or reject an "Apply to be creator" submission. Approving upserts a
// CreatorRateAccount (see Finance.prisma) so the new creator can earn and
// cash out immediately — otherwise the account stays admin-grantable-only,
// which would leave an approved applicant with nowhere to receive Rates.
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
  }

  const { userId } = await context.params;
  const existing = await prisma.creatorApplication.findUnique({ where: { userId } });
  if (!existing) {
    return notFoundResponse();
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { status, reviewNote } = parsed.data;

  const [application] = await prisma.$transaction([
    prisma.creatorApplication.update({
      data: { reviewedAt: new Date(), reviewedBy: request.donkey.userId, reviewNote: reviewNote || null, status },
      where: { userId },
    }),
    ...(status === "Approved"
      ? [prisma.creatorRateAccount.upsert({ create: { userId }, update: {}, where: { userId } })]
      : []),
    prisma.notification.create(
      notifyUser({
        body: reviewNote || NOTIFY_BODY[status],
        link: "/app/settings/payouts",
        title: `Creator application ${status.toLowerCase()}`,
        userId,
      }),
    ),
  ]);

  return NextResponse.json({ application });
});
