import { NextResponse } from "next/server";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Super-user only. Returns the real apiKey for one provider — called only on
// an explicit admin "reveal" click, kept out of the routinely-cached list
// query. Same pattern as /api/admin/social-apps/[id]/reveal.
export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const row = await prisma.apiIntegration.findUnique({ where: { id } });
  if (!row) {
    return notFoundResponse();
  }

  return NextResponse.json({ value: row.apiKey });
});
