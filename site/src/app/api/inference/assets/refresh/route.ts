import { NextResponse } from "next/server";

import {
  findChargedUsageEventByGenerationId,
  inferenceUsageRoutes,
  recordFailedInferenceUsage,
  refundInferenceCharge,
} from "@/lib/credits/inference";
import { refreshedAssetGenerationResponse } from "@/lib/inference/assets";
import { createProviderRegistry } from "@/lib/inference/router";
import {
  inferenceErrorCode,
  inferenceProviderErrorResponse,
  requireInferenceClientId,
  validationErrorResponse,
} from "@/lib/inference/responses";
import { storedGenerationForProviderSchema } from "@/lib/inference/schemas";
import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { InferenceProviderError } from "@/lib/inference/providers";

export const dynamic = "force-dynamic";

export const POST = withDepCutAuth(async (request) => {
  const client = requireInferenceClientId(request.depcut.clientId);
  if (!client.ok) {
    return client.response;
  }

  const parsed = storedGenerationForProviderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  // No credit gate here: the clip was billed flat at submit, so a poll does no
  // new billable work — and gating it would strand a render the user already
  // paid for behind a balance drained by sibling charges.
  try {
    const registry = createProviderRegistry();
    const result = await registry.refresh(parsed.data);

    // An operation that finished as FAILED did no billable work — no charge, but the failure
    // goes on the books so a dead render leaves a diagnostic trail instead of vanishing.
    // A render that got here bills flat at submit, before the outcome is known (see the
    // assets route), so a failure discovered only now still needs its original charge undone.
    if (result.status === "failed") {
      const originalCharge = await findChargedUsageEventByGenerationId(
        request.depcut.userId,
        inferenceUsageRoutes.assets,
        parsed.data.id,
      );
      if (originalCharge) {
        await refundInferenceCharge(originalCharge.id);
      }
      await recordFailedInferenceUsage({
        clientId: client.clientId,
        conversationId: request.depcut.conversationId,
        errorCode: "provider_error",
        metadata: {
          assetKind: parsed.data.kind,
          generationId: parsed.data.id,
          ...(result.error !== undefined && result.error !== null
            ? { providerError: result.error }
            : {}),
        },
        model: result.model,
        provider: result.provider,
        requestKind: "asset_generation",
        route: inferenceUsageRoutes.assets,
        userId: request.depcut.userId,
      });
    }

    return NextResponse.json(
      refreshedAssetGenerationResponse({
        generation: parsed.data,
        result,
      }),
    );
  } catch (error) {
    await recordFailedInferenceUsage({
      clientId: client.clientId,
      conversationId: request.depcut.conversationId,
      errorCode: inferenceErrorCode(error),
      metadata: {
        assetKind: parsed.data.kind,
      },
      model: parsed.data.model,
      provider: parsed.data.provider,
      requestKind: "asset_refresh",
      route: inferenceUsageRoutes.assetsRefresh,
      userId: request.depcut.userId,
    });
    if (error instanceof InferenceProviderError) {
      return inferenceProviderErrorResponse(error);
    }

    throw error;
  }
});
