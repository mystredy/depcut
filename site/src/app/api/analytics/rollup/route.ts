import { NextResponse } from "next/server";

import { getObject, R2NotConfiguredError } from "@/cut/server/cloud/r2";
import { ROLLUP_KEY } from "@/lib/analytics/pipeline";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";

export const dynamic = "force-dynamic";

// The consolidated analytics JSON, passed through exactly as the nightly job
// wrote it. It carries emails and balances, so it stays behind the super-user
// gate; the dashboard reads this and never the database.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }
  let rollup;
  try {
    rollup = await getObject(ROLLUP_KEY);
  } catch (e) {
    if (e instanceof R2NotConfiguredError) {
      return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
    }
    throw e;
  }
  if (!rollup) return NextResponse.json({ error: "No rollup yet." }, { status: 404 });
  return new NextResponse(new Uint8Array(rollup.bytes), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
});
