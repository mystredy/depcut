import { NextResponse } from "next/server";

import { listCutProjectsForAdmin } from "@/lib/admin/content";
import { lookupOwners } from "@/lib/admin/ownerLookup";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";

export const dynamic = "force-dynamic";

const exportedValues = ["yes", "no"] as const;

// Super-user only: the admin Content → Projects list — every video editor
// project across every account, most recently updated first. ?q filters by
// project name, ?owner by the account's name/display name/email, ?exported
// (yes|no) by whether it's ever been rendered, ?from/?to (ISO dates) by
// last-edited range.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can view this." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const exportedParam = params.get("exported");
  const from = params.get("from");
  const to = params.get("to");

  const rows = await listCutProjectsForAdmin({
    q: params.get("q") ?? undefined,
    ownerQuery: params.get("owner") ?? undefined,
    exported: exportedValues.find((v) => v === exportedParam),
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  const owners = await lookupOwners(rows.map((r) => r.userId));

  return NextResponse.json({
    items: rows.map((r) => ({ ...r, owner: owners.get(r.userId) ?? null })),
  });
});
