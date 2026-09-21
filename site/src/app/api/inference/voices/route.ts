import { NextResponse } from "next/server";
import { z } from "zod";

import { createProviderRegistry } from "@/lib/inference/router";
import { requireInferenceClientId, validationErrorResponse } from "@/lib/inference/responses";
import { withDepCutAuth } from "@/lib/depcut-api-auth";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  provider: z.string().min(1).max(100),
});

// Voice listing, not asset generation: free, like /api/inference/models.
export const GET = withDepCutAuth(async (request) => {
  const client = requireInferenceClientId(request.depcut.clientId);
  if (!client.ok) {
    return client.response;
  }

  const parsed = querySchema.safeParse({
    provider: request.nextUrl.searchParams.get("provider"),
  });
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const provider = createProviderRegistry().byID(parsed.data.provider);
  if (!provider?.listVoices) {
    return NextResponse.json(
      { error: "Not found", message: "That provider has no voice catalog." },
      { status: 404 },
    );
  }

  const voices = await provider.listVoices();
  return NextResponse.json({ data: voices });
});
