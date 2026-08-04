import { NextResponse } from "next/server";

import { creditMicrosToString } from "@/lib/credits/amounts";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const usersPageSize = 50;

// Super-user only: search/list accounts with their credit balance, for the
// admin panel's Users & Credits page.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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

  return NextResponse.json({
    users: users.map((u) => ({
      balance: creditMicrosToString(u.creditAccount?.balanceMicros ?? BigInt(0)),
      createdAt: u.createdAt.toISOString(),
      displayName: u.displayName,
      email: u.email,
      id: u.id,
      image: u.image,
      lifetimeCharged: creditMicrosToString(u.creditAccount?.lifetimeChargedMicros ?? BigInt(0)),
      lifetimeGranted: creditMicrosToString(u.creditAccount?.lifetimeGrantedMicros ?? BigInt(0)),
      name: u.name,
      superUser: u.superUser,
    })),
  });
});
