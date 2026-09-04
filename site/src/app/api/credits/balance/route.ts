import { NextResponse } from "next/server";

import { getCreditBalance } from "@/lib/credits/inference";
import { withDepCutAuth } from "@/lib/depcut-api-auth";

export const dynamic = "force-dynamic";

export const GET = withDepCutAuth(async (request) => {
  const balance = await getCreditBalance(request.depcut.userId);

  return NextResponse.json(balance);
});
