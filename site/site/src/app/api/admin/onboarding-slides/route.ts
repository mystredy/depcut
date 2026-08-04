import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { listOnboardingSlideCopy } from "@/lib/onboarding/slide-copy";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds all six slides from their original hardcoded
// copy on first read.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const slides = await listOnboardingSlideCopy();

  return NextResponse.json({ slides });
});
