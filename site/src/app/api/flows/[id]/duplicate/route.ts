import { NextResponse } from "next/server";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { duplicateFlow, ownedFlow } from "@/lib/flows/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Duplicate Flow — a new thread with the same generations, pointing at the
// same R2 objects (immutable once written, so nothing is re-uploaded).
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const copy = await duplicateFlow(request.donkey.userId, flow);
  return NextResponse.json({ flow: copy }, { status: 201 });
});
