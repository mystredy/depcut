import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { createFlow, listFlows } from "@/lib/flows/db";

export const dynamic = "force-dynamic";

const kindFilter = z.enum(["image", "video"]).optional();

// The Flow gallery — every creative thread this user owns, most recently
// updated first. ?q= searches Flow name and generation prompts, ?kind=
// restricts to Flows containing that kind, ?favorite=1 to Flows containing
// a favorited generation — combinable, all applied server-side.
export const GET = withDepCutAuth(async (request) => {
  const params = request.nextUrl.searchParams;
  const kind = kindFilter.safeParse(params.get("kind") ?? undefined);
  if (!kind.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const flows = await listFlows(request.depcut.userId, {
    q: params.get("q") ?? undefined,
    kind: kind.data,
    favoritesOnly: params.get("favorite") === "1",
  });
  return NextResponse.json({ flows });
});

const createSchema = z.object({ name: z.string().trim().min(1).max(100).optional() }).strict();

// "New Flow" — a blank thread, named until the first generation's prompt
// renames it (see PATCH .../[id]).
export const POST = withDepCutAuth(async (request) => {
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const flow = await createFlow(request.depcut.userId, parsed.data.name?.trim() || "New Flow");
  return NextResponse.json({ flow }, { status: 201 });
});
