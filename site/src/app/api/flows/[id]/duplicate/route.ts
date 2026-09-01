import { NextResponse } from "next/server";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { duplicateFlow, ownedFlow } from "@/lib/flows/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Duplicate Flow — a new thread with the same generations, each one's media
// copied to its own fresh R2 object (never left pointing at the source's
// keys — see duplicateFlow) so the two Flows are independently deletable.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const duplicated = await duplicateFlow(request.donkey.userId, flow);
  return NextResponse.json({ flow: duplicated }, { status: 201 });
});
