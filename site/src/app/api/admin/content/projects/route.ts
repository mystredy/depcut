import { NextResponse } from "next/server";

import { listCutProjectsForAdmin } from "@/lib/admin/content";
import { lookupOwners } from "@/lib/admin/ownerLookup";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";

export const dynamic = "force-dynamic";

// Super-user only: the admin Content → Projects list — every video editor
// project across every account, most recently updated first.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can view this." }, { status: 403 });
  }

  const rows = await listCutProjectsForAdmin();
  const owners = await lookupOwners(rows.map((r) => r.userId));

  return NextResponse.json({
    items: rows.map((r) => ({ ...r, owner: owners.get(r.userId) ?? null })),
  });
});
