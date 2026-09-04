import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { requireInferenceClientId } from "@/lib/inference/responses";
import { mintVertexLiveConnection } from "@/lib/inference/vertex-live";

export const dynamic = "force-dynamic";

// Mints a short-lived Vertex AI access token so a DepCut client can open a
// Gemini Live websocket directly. The long-lived service-account credential
// stays on the backend. Errors propagate raw.
export const POST = withDepCutAuth(async (request) => {
  const client = requireInferenceClientId(request.depcut.clientId);
  if (!client.ok) {
    return client.response;
  }

  const connection = await mintVertexLiveConnection();
  return NextResponse.json(connection, {
    headers: { "Cache-Control": "no-store" },
  });
});
