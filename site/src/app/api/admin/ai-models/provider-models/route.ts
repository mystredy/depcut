import { NextResponse } from "next/server";

import { AI_MODALITIES, type AiModality } from "@/lib/ai-models-seed";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { API_INTEGRATION_SEED, type ApiIntegrationProvider } from "@/lib/marketplace/api-integrations-seed";
import { listProviderModels } from "@/lib/provider-model-catalog";

export const dynamic = "force-dynamic";

// Super-user only. Live discovery for the Add-model dialog's provider step —
// see provider-model-catalog.ts for what "live" means per provider, and for
// how the result is narrowed to just this modality's models.
//
// The whole body sits behind one try/catch, including the super-user check —
// that check is a DB read too, and a transient failure there (a dropped
// Supabase connection) is exactly as recoverable as a failed provider fetch.
// Left outside the try, it would escape as an uncaught exception: withDonkeyAuth
// re-throws it, Next answers with its bare framework 500, and the client's
// apiFetch — unable to parse an HTML error page as JSON — falls back to the
// response's statusText, surfacing a bare "Internal Server Error" instead of
// the dialog's own "Enter manually instead" fallback.
export const GET = withDonkeyAuth(async (request) => {
  try {
    if (!(await isDonkeySuperUser(request.donkey.userId))) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only super users can view this." },
        { status: 403 },
      );
    }

    const params = new URL(request.url).searchParams;
    const provider = params.get("provider");
    const modality = params.get("modality");
    if (!provider || !(API_INTEGRATION_SEED as readonly string[]).includes(provider)) {
      return NextResponse.json(
        { error: "Invalid request", message: "Unknown provider." },
        { status: 400 },
      );
    }
    if (!modality || !(AI_MODALITIES as readonly string[]).includes(modality)) {
      return NextResponse.json(
        { error: "Invalid request", message: "Unknown modality." },
        { status: 400 },
      );
    }

    const models = await listProviderModels(provider as ApiIntegrationProvider, modality as AiModality);
    return NextResponse.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't fetch models for that provider.";
    return NextResponse.json({ error: "Fetch failed", message }, { status: 502 });
  }
});
