import { copyJobs } from "@/cut/server/cloud/copyQueue";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Super-user only: clone any account's project into the admin's own — the
// Content → Projects list's "Clone to my account" action, for re-editing or
// investigating a report without touching the original. Queues the same
// copy-job pipeline an owner's own "Duplicate" already uses (see
// copyQueue.ts's requestAdminClone); the client polls it the same way too.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
  }
  const { id } = await context.params;
  return copyJobs.requestAdminClone(request.donkey.userId, id);
});
