import { NextResponse } from "next/server";

import { creditMicrosToString } from "@/lib/credits/amounts";
import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Up to 5 pages of 25 in the admin's Usage dialog, same window as the
// self-service Usage tab (api/billing/usage).
const RECENT_LIMIT = 125;

// Super-user only: one account's own inference usage history, for the "..."
// menu's "Usage" item on the AI Credits balances table. Same shape as the
// self-service Usage tab's rows, minus the Vision API split and conversation
// grouping — admin review just needs the flat recent-calls list.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const events = await prisma.inferenceUsageEvent.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      creditCostMicros: true,
      errorCode: true,
      model: true,
      requestKind: true,
      status: true,
    },
    take: RECENT_LIMIT,
    where: { userId: id },
  });

  return NextResponse.json({
    events: events.map((e) => ({
      costCredits: creditMicrosToString(e.creditCostMicros),
      createdAt: e.createdAt.toISOString(),
      errorCode: e.errorCode,
      model: e.model,
      requestKind: e.requestKind,
      status: e.status,
    })),
  });
});
