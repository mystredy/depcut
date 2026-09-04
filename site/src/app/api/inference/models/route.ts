import { NextResponse } from "next/server";

import { createProviderRegistry } from "@/lib/inference/router";
import { requireInferenceClientId } from "@/lib/inference/responses";
import { parseRequestedModalities } from "@/lib/inference/schemas";
import { withDepCutAuth } from "@/lib/depcut-api-auth";

export const dynamic = "force-dynamic";

export const GET = withDepCutAuth(async (request) => {
  const client = requireInferenceClientId(request.depcut.clientId);
  if (!client.ok) {
    return client.response;
  }

  const modalities = parseRequestedModalities(
    request.nextUrl.searchParams.get("output_modalities"),
  );
  const registry = createProviderRegistry();
  const models = await registry.listModels([...modalities]);

  return NextResponse.json({
    data: models,
  });
});
