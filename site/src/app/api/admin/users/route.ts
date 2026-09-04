import { NextResponse } from "next/server";

import { creditMicrosToString } from "@/lib/credits/amounts";
import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const usersPageSize = 50;

// Super-user only: search/list accounts with their credit balance, for the
// admin panel's Users & Credits page.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      creditAccount: {
        select: { balanceMicros: true, lifetimeChargedMicros: true, lifetimeGrantedMicros: true },
      },
      displayName: true,
      email: true,
      id: true,
      image: true,
      name: true,
      superUser: true,
    },
    take: usersPageSize,
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
  });

  // "Last active" — the session's own updatedAt, which better-auth touches
  // on validation at most once per its updateAge (one day here, see
  // auth.ts), so this is accurate to within roughly a day, not live. A
  // groupBy scoped to just this page's users, not a per-row relation load.
  const lastActive = await prisma.session.groupBy({
    _max: { updatedAt: true },
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) } },
  });
  const lastActiveByUserId = new Map(lastActive.map((s) => [s.userId, s._max.updatedAt]));

  return NextResponse.json({
    users: users.map((u) => ({
      balance: creditMicrosToString(u.creditAccount?.balanceMicros ?? BigInt(0)),
      createdAt: u.createdAt.toISOString(),
      displayName: u.displayName,
      email: u.email,
      id: u.id,
      image: u.image,
      lastActiveAt: lastActiveByUserId.get(u.id)?.toISOString() ?? null,
      lifetimeCharged: creditMicrosToString(u.creditAccount?.lifetimeChargedMicros ?? BigInt(0)),
      lifetimeGranted: creditMicrosToString(u.creditAccount?.lifetimeGrantedMicros ?? BigInt(0)),
      name: u.name,
      superUser: u.superUser,
    })),
  });
});
