import { NextResponse } from "next/server";

import { listAudioGenerationsForAdmin, type AudioTool } from "@/lib/audioGenerations/db";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { lookupOwners } from "@/lib/admin/ownerLookup";

export const dynamic = "force-dynamic";

const TOOLS: readonly AudioTool[] = ["text-to-speech", "dubbing"];

// Super-user only: the admin Content → Audio list — every Text to Speech and
// Dubbing render across every account, most recent first.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can view this." }, { status: 403 });
  }

  const toolParam = new URL(request.url).searchParams.get("tool");
  const tool = TOOLS.find((t) => t === toolParam);

  const rows = await listAudioGenerationsForAdmin(tool);
  const owners = await lookupOwners(rows.map((r) => r.userId));

  return NextResponse.json({
    items: rows.map((r) => ({ ...r, owner: owners.get(r.userId) ?? null })),
  });
});
