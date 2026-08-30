import { NextResponse } from "next/server";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { listAiModels } from "@/lib/ai-models";

export const dynamic = "force-dynamic";

// Any signed-in user — no admin gate. The composers (video/image generate
// panels) call this to filter their model pickers down to what an admin has
// actually left enabled; see src/cut/lib/aiModelAvailability.ts.
export const GET = withDonkeyAuth(async () => {
  const rows = await listAiModels();

  return NextResponse.json({
    models: rows.map((r) => ({ enabled: r.enabled, modality: r.modality, tier: r.tier })),
  });
});
