import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { listOnboardingSlideCopy } from "@/lib/onboarding/slide-copy";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds all six slides from their original hardcoded
// copy on first read.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const slides = await listOnboardingSlideCopy();

  return NextResponse.json({ slides });
});
