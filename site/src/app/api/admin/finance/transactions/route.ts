import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. The append-only finance event ledger, filterable by user
// name, type, and status.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const params = new URL(request.url).searchParams;
  const user = params.get("user")?.trim();
  const type = params.get("type")?.trim();
  const status = params.get("status")?.trim();

  const transactions = await prisma.financeTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    where: {
      ...(user ? { userName: { contains: user, mode: "insensitive" } } : {}),
      ...(type && type !== "All" ? { type } : {}),
      ...(status && status !== "All" ? { status } : {}),
    },
  });

  return NextResponse.json({ transactions });
});
