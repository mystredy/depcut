import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every creator with a Payout (USD) balance — separate
// from /api/admin/finance/rates, which reports the Artist Earnings (Rates)
// wallet. This is the one Withdrawals actually draws down.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { displayName: true, email: true, id: true, image: true, name: true, payoutAccount: true },
    where: {
      payoutAccount: { isNot: null },
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
  });

  const accounts = users.map((u) => ({
    available: u.payoutAccount?.available ?? 0,
    email: u.email,
    image: u.image,
    lifetime: u.payoutAccount?.lifetime ?? 0,
    name: u.displayName || u.name,
    userId: u.id,
  }));

  return NextResponse.json({ accounts });
});
