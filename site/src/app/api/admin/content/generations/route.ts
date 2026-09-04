import { NextResponse } from "next/server";

import { listFlowGenerationsForAdmin } from "@/lib/admin/content";
import { lookupOwners } from "@/lib/admin/ownerLookup";
import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";

export const dynamic = "force-dynamic";

// Super-user only: the admin Content → Images/Videos lists — every
// completed Flow generation of the given kind across every account, most
// recent first.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can view this." }, { status: 403 });
  }

  const kindParam = new URL(request.url).searchParams.get("kind");
  const kind = kindParam === "image" || kindParam === "video" ? kindParam : null;
  if (!kind) {
    return NextResponse.json({ error: "Invalid request", message: "kind must be image or video." }, { status: 400 });
  }

  const rows = await listFlowGenerationsForAdmin(kind);
  const owners = await lookupOwners(rows.map((r) => r.userId));

  return NextResponse.json({
    items: rows.map((r) => ({ ...r, owner: owners.get(r.userId) ?? null })),
  });
});
