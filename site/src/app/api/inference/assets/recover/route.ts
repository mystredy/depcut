import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { requireInferenceClientId } from "@/lib/inference/responses";
import { getObject, inferenceOutputKey } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

// Reads back a speech result's durable safety copy (see
// persistSpeechRecoveryCopy in ../route.ts) — the fallback when the original
// POST /api/inference/assets response never reached the client (a dropped
// mobile connection on a slow, single-shot generation). No credit gate: the
// generation already billed at submit, this only recovers bytes that
// otherwise would have been silently lost. 404 covers every "nothing to
// recover" case alike — never generated, already swept past 24h, or a
// storage write that itself failed — so the caller's fallback is the same
// either way: report the failure and let the user try again.
export const GET = withDepCutAuth(async (request) => {
  const client = requireInferenceClientId(request.depcut.clientId);
  if (!client.ok) {
    return client.response;
  }

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const object = await getObject(inferenceOutputKey(request.depcut.userId, id));
  if (!object) {
    return NextResponse.json({ error: "Nothing to recover for that generation." }, { status: 404 });
  }

  return NextResponse.json({
    outputs: [
      {
        id: "audio-1",
        kind: "audio",
        dataBase64: object.bytes.toString("base64"),
        contentType: object.mime,
      },
    ],
  });
});
