import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { listAiModels } from "@/lib/ai-models";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds via listAiModels() — see that file's header.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await listAiModels();

  return NextResponse.json({
    models: rows.map((r) => ({
      enabled: r.enabled,
      id: r.id,
      label: r.label,
      modality: r.modality,
      modelId: r.modelId,
      tier: r.tier,
      updatedAt: r.updatedAt,
    })),
  });
});
