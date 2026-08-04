import { NextResponse } from "next/server";

import { listOnboardingSlideCopy } from "@/lib/onboarding/slide-copy";

export const dynamic = "force-dynamic";

// Public read of the onboarding slides' editable copy — not sensitive, and
// the welcome sequence needs it before any admin gate would apply.
export async function GET() {
  const slides = await listOnboardingSlideCopy();
  return NextResponse.json({ slides });
}
