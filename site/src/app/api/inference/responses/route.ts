import { NextResponse } from "next/server";

import {
  creditErrorResponse,
  creditUsageHeaders,
  inferenceUsageRoutes,
  recordFailedInferenceUsage,
  recordInferenceUsage,
  requireInferenceCredits,
} from "@/lib/credits/inference";
import { createProviderRegistry } from "@/lib/inference/router";
import { resolveInferenceBlobs } from "@/lib/inference/blobs";
import { isJsonObject, toJsonObject, toJsonValue } from "@/lib/inference/json";
import {
  inferenceErrorCode,
  inferenceProviderErrorResponse,
  requireInferenceClientId,
  validationErrorResponse,
} from "@/lib/inference/responses";
import { InferenceProviderError } from "@/lib/inference/providers";
import type { JsonObject, JsonValue } from "@/lib/inference/providers";
import { responseCreateRequestSchema } from "@/lib/inference/schemas";
import {
  shouldBypassDepCutInferenceCredits,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";

export const dynamic = "force-dynamic";

export const POST = withDepCutAuth(async (request) => {
  const client = requireInferenceClientId(request.depcut.clientId);
  if (!client.ok) {
    return client.response;
  }

  const parsed = responseCreateRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const requestedModel =
    typeof parsed.data.body.model === "string" && parsed.data.body.model.trim()
      ? parsed.data.body.model.trim()
      : "unknown";
  const bypassCredits = shouldBypassDepCutInferenceCredits(request.depcut);
  if (!bypassCredits) {
    const credits = await requireInferenceCredits({
      model: requestedModel,
      provider: parsed.data.depcutProvider,
      route: inferenceUsageRoutes.responses,
      userId: request.depcut.userId,
    });
    if (!credits.ok) {
      return credits.response;
    }
  }

  const debugInspection = isDebugUIInspectionRequest(parsed.data.body);
  const debugInspectionStartedAt = performance.now();
  if (debugInspection) {
    console.info(
      [
        "[debug-ui-inspection] start",
        `at=${new Date().toISOString()}`,
        `provider=${parsed.data.depcutProvider ?? "default"}`,
        `requestedModel=${requestedModel}`,
      ].join(" "),
    );
  }

  let failedUsageProvider = parsed.data.depcutProvider ?? "default";

  try {
    // Attached pictures and sound ride storage, not the request body — they
    // become inline content parts here, on the server-to-server leg.
    const data = {
      ...parsed.data,
      body: toJsonObject(
        await resolveInferenceBlobs(parsed.data.body, request.depcut.userId),
      ),
    };
    const registry = createProviderRegistry();
    const provider = registry.responsesProvider(data);
    failedUsageProvider = provider.id;

    if (data.stream) {
      const streamed = await provider.createResponseStream?.(data);
      if (!streamed) {
        if (!bypassCredits) {
          await recordFailedInferenceUsage({
            clientId: client.clientId,
            conversationId: request.depcut.conversationId,
            errorCode: "streaming_unavailable",
            model: requestedModel,
            provider: failedUsageProvider,
            requestKind: "responses",
            route: inferenceUsageRoutes.responses,
            userId: request.depcut.userId,
          });
        }

        return NextResponse.json(
          {
            error: "Streaming unavailable",
          },
          { status: 503 },
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (data: unknown) =>
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
            );
          try {
            for await (const event of streamed.events) {
              if (event.type === "output_text_delta") {
                send({ type: "response.output_text.delta", delta: event.delta });
                continue;
              }
              // Bill from the terminal usage before the terminal event goes
              // out: the invocation lives only as long as the stream, so the
              // usage row must land before the client can stop reading.
              if (!bypassCredits) {
                await recordInferenceUsage({
                  clientId: client.clientId,
                  conversationId: request.depcut.conversationId,
                  model: streamed.model,
                  provider: streamed.provider,
                  requestKind: "responses",
                  route: inferenceUsageRoutes.responses,
                  status: "succeeded",
                  usage: event.usage,
                  userId: request.depcut.userId,
                });
              }
              send({ type: "response.completed", response: event.body });
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (error) {
            if (!bypassCredits) {
              await recordFailedInferenceUsage({
                clientId: client.clientId,
                conversationId: request.depcut.conversationId,
                errorCode: inferenceErrorCode(error),
                model: streamed.model,
                provider: streamed.provider,
                requestKind: "responses",
                route: inferenceUsageRoutes.responses,
                userId: request.depcut.userId,
              }).catch(() => {});
            }
            // A mid-stream failure surfaces as a terminal SSE error event so
            // the client stops cleanly instead of hanging on a truncated stream.
            const message =
              error instanceof Error ? error.message : "stream failed";
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ message })}\n\n`,
              ),
            );
          } finally {
            controller.close();
          }
        },
      });

      const bypassHeaders: Record<string, string> = bypassCredits
        ? { "X-DepCut-Dev-Auth-Bypass": "true" }
        : {};
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-DepCut-Inference-Provider": streamed.provider,
          "X-DepCut-Inference-Model": streamed.model,
          ...bypassHeaders,
        },
      });
    }

    const providerStartedAt = performance.now();
    const result = await provider.createResponse?.(data);
    if (!result) {
      if (!bypassCredits) {
        await recordFailedInferenceUsage({
          clientId: client.clientId,
          conversationId: request.depcut.conversationId,
          errorCode: "responses_unavailable",
          model: requestedModel,
          provider: failedUsageProvider,
          requestKind: "responses",
          route: inferenceUsageRoutes.responses,
          userId: request.depcut.userId,
        });
      }

      return NextResponse.json(
        {
          error: "Responses unavailable",
        },
        { status: 503 },
      );
    }

    let usageHeaders: Record<string, string> = {};
    if (bypassCredits) {
      usageHeaders["X-DepCut-Dev-Auth-Bypass"] = "true";
    } else {
      const recordedUsage = await recordInferenceUsage({
        clientId: client.clientId,
        conversationId: request.depcut.conversationId,
        model: result.model,
        provider: result.provider,
        requestKind: "responses",
        route: inferenceUsageRoutes.responses,
        status: "succeeded",
        usage: result.usage,
        userId: request.depcut.userId,
      });
      usageHeaders = creditUsageHeaders(recordedUsage);
    }

    if (debugInspection) {
      const providerEndedAt = performance.now();
      console.info(
        [
          "[debug-ui-inspection] end",
          `at=${new Date().toISOString()}`,
          `provider=${result.provider}`,
          `model=${result.model}`,
          `providerMs=${Math.round(providerEndedAt - providerStartedAt)}`,
          `totalMs=${Math.round(providerEndedAt - debugInspectionStartedAt)}`,
          debugInspectionResultSummary(result.body),
        ].join(" "),
      );
    }

    return NextResponse.json(result.body, {
      headers: {
        "X-DepCut-Inference-Provider": result.provider,
        "X-DepCut-Inference-Model": result.model,
        ...usageHeaders,
      },
    });
  } catch (error) {
    if (!bypassCredits) {
      await recordFailedInferenceUsage({
        clientId: client.clientId,
        conversationId: request.depcut.conversationId,
        errorCode: inferenceErrorCode(error),
        model: requestedModel,
        provider: failedUsageProvider,
        requestKind: "responses",
        route: inferenceUsageRoutes.responses,
        userId: request.depcut.userId,
      });
    }
    const creditResponse = creditErrorResponse(error);
    if (creditResponse) {
      return creditResponse;
    }
    if (error instanceof InferenceProviderError) {
      return inferenceProviderErrorResponse(error);
    }

    throw error;
  }
});

function isDebugUIInspectionRequest(body: JsonObject) {
  if (!Array.isArray(body.tools)) {
    return false;
  }

  return body.tools.some((tool) => {
    return isJsonObject(tool) && tool.type === "depcut_debug_ui_inspection";
  });
}

function debugInspectionResultSummary(body: JsonValue) {
  const object: JsonObject = isJsonObject(body) ? body : {};
  const outputText = typeof object.output_text === "string" ? object.output_text : "";
  const elementCount =
    elementCountFromFrame(object) ??
    elementCountFromOutputText(outputText);

  return [
    `outputTextChars=${outputText.length}`,
    `elements=${elementCount ?? "unknown"}`,
  ].join(" ");
}

function elementCountFromOutputText(outputText: string) {
  if (!outputText.trim()) {
    return null;
  }

  try {
    return elementCountFromFrame(toJsonValue(JSON.parse(outputText)));
  } catch {
    return null;
  }
}

function elementCountFromFrame(value: JsonValue) {
  if (!isJsonObject(value) || !Array.isArray(value.elements)) {
    return null;
  }

  return value.elements.length;
}
