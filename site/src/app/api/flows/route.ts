import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { createFlow, listFlows } from "@/lib/flows/db";

export const dynamic = "force-dynamic";

// The Flow gallery — every creative thread this user owns, most recently
// updated first.
export const GET = withDonkeyAuth(async (request) => {
  const flows = await listFlows(request.donkey.userId);
  return NextResponse.json({ flows });
});

const createSchema = z.object({ name: z.string().trim().min(1).max(100).optional() }).strict();

// "New Flow" — a blank thread, named until the first generation's prompt
// renames it (see PATCH .../[id]).
export const POST = withDonkeyAuth(async (request) => {
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const flow = await createFlow(request.donkey.userId, parsed.data.name?.trim() || "New Flow");
  return NextResponse.json({ flow }, { status: 201 });
});
