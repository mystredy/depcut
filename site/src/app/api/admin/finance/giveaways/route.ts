import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Manually-recorded giveaway prize payouts — see
// Finance.prisma's GiveawayPayment comment.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await prisma.giveawayPayment.findMany({
    include: { user: { select: { displayName: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const giveaways = rows.map((g) => ({ ...g, userName: g.user.displayName || g.user.name }));

  return NextResponse.json({ giveaways });
});

const createSchema = z
  .object({
    userId: z.string().trim().min(1),
    topPosition: z.string().trim().min(1).max(60),
    reward: z.string().trim().min(1).max(120),
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

  const giveaway = await prisma.giveawayPayment.create({ data: parsed.data });

  return NextResponse.json({ giveaway });
});
