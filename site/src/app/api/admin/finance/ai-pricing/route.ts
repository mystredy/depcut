import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import {
  listKnownProviderRates,
  providerCreditPricing,
  type ProviderCreditPricing,
} from "@/lib/credits/provider-pricing";

export const dynamic = "force-dynamic";

type SerializedPricing = {
  inputTokenCostMicrosPerMillion?: string;
  cachedInputTokenCostMicrosPerMillion?: string;
  outputTokenCostMicrosPerMillion?: string;
  inputAudioTokenCostMicrosPerMillion?: string;
  cachedInputAudioTokenCostMicrosPerMillion?: string;
  outputAudioTokenCostMicrosPerMillion?: string;
  characterCostMicros?: string;
  durationSecondCostMicros?: string;
  generationCostMicros?: string;
  longContextThresholdTokens?: string;
  longContext?: SerializedPricing;
};

// Every micros field as a decimal string — same convention as the credit
// balance route (lib/credits/inference.ts's balanceMicros.toString()), since
// a bigint can't cross JSON as-is.
function serializePricing(pricing: ProviderCreditPricing): SerializedPricing {
  const {
    inputTokenCostMicrosPerMillion,
    cachedInputTokenCostMicrosPerMillion,
    outputTokenCostMicrosPerMillion,
    inputAudioTokenCostMicrosPerMillion,
    cachedInputAudioTokenCostMicrosPerMillion,
    outputAudioTokenCostMicrosPerMillion,
    characterCostMicros,
    durationSecondCostMicros,
    generationCostMicros,
    longContextThresholdTokens,
    longContext,
  } = pricing;

  return {
    inputTokenCostMicrosPerMillion: inputTokenCostMicrosPerMillion?.toString(),
    cachedInputTokenCostMicrosPerMillion: cachedInputTokenCostMicrosPerMillion?.toString(),
    outputTokenCostMicrosPerMillion: outputTokenCostMicrosPerMillion?.toString(),
    inputAudioTokenCostMicrosPerMillion: inputAudioTokenCostMicrosPerMillion?.toString(),
    cachedInputAudioTokenCostMicrosPerMillion: cachedInputAudioTokenCostMicrosPerMillion?.toString(),
    outputAudioTokenCostMicrosPerMillion: outputAudioTokenCostMicrosPerMillion?.toString(),
    characterCostMicros: characterCostMicros?.toString(),
    durationSecondCostMicros: durationSecondCostMicros?.toString(),
    generationCostMicros: generationCostMicros?.toString(),
    longContextThresholdTokens: longContextThresholdTokens?.toString(),
    longContext: longContext ? serializePricing(longContext) : undefined,
  };
}

// Super-user only, read-only. Every rate here is the exact fallback
// providerCreditPricing() resolves — the same function a real generation
// bills against — so this can never show a stale or invented number; there
// is no database rate override to layer on top of it (yet).
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rates = listKnownProviderRates().map((rate) => ({
    provider: rate.provider,
    model: rate.model,
    label: rate.label,
    pricing: serializePricing(rate.pricing),
  }));

  const browserUse = providerCreditPricing("browser-use", "");
  if (browserUse) {
    rates.push({
      provider: "browser-use",
      model: "",
      label: "Browser Use agent (per step)",
      pricing: serializePricing(browserUse),
    });
  }

  return NextResponse.json({ rates });
});
