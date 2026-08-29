import { GenerateVideosOperation, GoogleGenAI } from "@google/genai";
import type { GoogleGenAIOptions } from "@google/genai";

import {
  geminiApiError,
  geminiClientConfig,
  stringValue,
  type AdapterEnvironment,
} from "@/lib/inference/adapters/gemini-client";
import { providerCreditPricing } from "@/lib/credits/provider-pricing";
import { geminiVeoModels } from "@/lib/inference/gemini-models";
import { ensureConfigured } from "@/lib/inference/http";
import { isJsonObject, toJsonObject } from "@/lib/inference/json";
import {
  InferenceProviderError,
  type AssetGenerationProviderRequest,
  type AssetGenerationProviderResult,
  type GenerationOutputRef,
  type InferenceModality,
  type InferenceModel,
  type InferenceProvider,
  type StoredGenerationForProvider,
} from "@/lib/inference/providers";

// The Veo 3.1 video generation provider, over the models.generateVideos
// long-running-operation API — distinct from Omni's Interactions API, and kept
// as a separate provider id so refresh routing and pricing never conflate the
// two. A submit returns an operation; the caller polls operations.getVideosOperation
// (by the operation's `name`, the only field it reads) until it lands. Unlike
// Omni, Veo takes no reference-image identity anchors as a single flat list —
// each carries a type (ASSET keeps a subject consistent; STYLE carries a look) —
// so an anchor set rides as ASSET references, the closer match to Omni's usage.
// A start frame can also pair with a documented closing frame (lastFrame);
// Omni has no equivalent, so the panel only sends it here.
const providerID = "gemini-veo";

export type GeminiVeoClient = Pick<GoogleGenAI, "models" | "operations">;
export type GeminiVeoClientFactory = (options: GoogleGenAIOptions) => GeminiVeoClient;

const defaultVeoClientFactory: GeminiVeoClientFactory = (options) => new GoogleGenAI(options);

export function createGeminiVeoVideoAssetProvider(
  environment: AdapterEnvironment = process.env,
  clientFactory: GeminiVeoClientFactory = defaultVeoClientFactory,
): InferenceProvider {
  const clientConfig = geminiClientConfig(environment);
  const configured = clientConfig.configured;
  const defaultModel = geminiVeoModels.quality;

  async function listModels(modalities: InferenceModality[]): Promise<InferenceModel[]> {
    if (!modalities.includes("video")) {
      return [];
    }
    return Object.values(geminiVeoModels).map((id) => ({
      id,
      name: id,
      provider: providerID,
      inputModalities: ["text", "image"],
      outputModalities: ["video"],
      contextLength: null,
      pricing: null,
      metadata: { provider: providerID, api: "generateVideos" },
    }));
  }

  function resolveModel(requested?: string): string {
    const model = requested?.trim() || defaultModel;
    // Fail before spending: the resolved model must have a configured price.
    if (!providerCreditPricing(providerID, model)) {
      throw new InferenceProviderError(
        "No credit price is configured for the selected video model.",
        { statusCode: 500, code: "video_model_not_priced", details: { model } },
      );
    }
    return model;
  }

  async function generateAsset({
    request,
  }: AssetGenerationProviderRequest): Promise<AssetGenerationProviderResult> {
    ensureConfigured(configured);

    if (request.kind !== "video") {
      throw new InferenceProviderError("Provider does not support this asset kind.", {
        statusCode: 400,
        code: "unsupported_asset_kind",
      });
    }

    const model = resolveModel(request.model);
    const basePrompt = request.prompt?.trim();
    const inputs = toJsonObject(request.inputs ?? {});
    const seed = firstInlineImage(inputs.images);
    const references = inlineImages(inputs.referenceImages);
    const endFrame = firstInlineImage(inputs.lastFrame);
    // A render takes one conditioning mode: a seed frame XOR identity
    // references. Both at once is a caller bug — reject it rather than
    // silently dropping the identity anchors from a billed render.
    if (seed && references.length > 0) {
      throw new InferenceProviderError(
        "Video generation takes an input image or reference images, not both.",
        { statusCode: 400, code: "conflicting_video_inputs" },
      );
    }
    if (!basePrompt && !seed) {
      throw new InferenceProviderError(
        "Video generation requires a prompt or an input image.",
        { statusCode: 400, code: "empty_video_request" },
      );
    }

    const parameters = toJsonObject(request.parameters ?? {});
    // The model has no negative-prompt parameter, so the bans ride the prompt
    // itself as an avoid clause — same treatment the image and Omni models get.
    const negative = stringValue(parameters.negativePrompt)?.trim();
    const prompt = [basePrompt, negative ? `Avoid: ${negative}.` : ""].filter(Boolean).join(" ");
    const aspectRatio = stringValue(parameters.aspectRatio);
    const resolution = stringValue(parameters.resolution);
    const durationSeconds =
      typeof parameters.durationSeconds === "number" ? parameters.durationSeconds : undefined;

    const client = clientFactory(clientConfig.options);
    let operation: GenerateVideosOperation;
    try {
      operation = await client.models.generateVideos({
        model,
        prompt,
        ...(seed ? { image: { imageBytes: seed.data, mimeType: seed.mimeType } } : {}),
        config: {
          generateAudio: true,
          ...(aspectRatio === "16:9" || aspectRatio === "9:16" ? { aspectRatio } : {}),
          ...(resolution === "720p" || resolution === "1080p" ? { resolution } : {}),
          // Veo 3.1 only takes 4, 6, or 8 for 720p/1080p — an out-of-range
          // value rides through unclamped, so the caller (the generate panel's
          // duration control) is what keeps it honest.
          ...(durationSeconds ? { durationSeconds } : {}),
          ...(references.length > 0
            ? {
                referenceImages: references.map((r) => ({
                  image: { imageBytes: r.data, mimeType: r.mimeType },
                  referenceType: "ASSET" as never,
                })),
              }
            : {}),
          // Only meaningful alongside a start frame — Google's own docs mark
          // it image-to-video only.
          ...(seed && endFrame
            ? { lastFrame: { imageBytes: endFrame.data, mimeType: endFrame.mimeType } }
            : {}),
        },
      });
    } catch (error) {
      throw geminiApiError("Veo video generation failed.", error);
    }

    // Rare fast path: the operation may already be complete on submit.
    const settled = settledResult(operation, model);
    if (settled) {
      return settled;
    }

    // In progress: the clip is committed, so the flat clip price bills now —
    // generationCount is the billing unit (provider-pricing.ts), since the
    // async submit carries no usage and the polls that follow are free. Only
    // the submit carries it; a refresh poll's in-progress result must not.
    return { ...inProgressResult(operation.name ?? "", model), usage: { generationCount: 1 } };
  }

  async function refreshAsset(
    generation: StoredGenerationForProvider,
  ): Promise<AssetGenerationProviderResult> {
    ensureConfigured(configured);

    const operationName =
      generation.providerGenerationId?.trim() || generation.providerJobId?.trim();
    if (!operationName) {
      return failedResult(generation.model, "No Veo operation to poll.");
    }

    const client = clientFactory(clientConfig.options);
    // getVideosOperation reads only `.name` off the operation it's handed, then
    // calls its `_fromAPIResponse` to build the updated one — so a bare instance
    // with just the name set round-trips fine across the stateless poll.
    const pending = new GenerateVideosOperation();
    pending.name = operationName;
    let operation: GenerateVideosOperation;
    try {
      operation = await client.operations.getVideosOperation({ operation: pending });
    } catch (error) {
      throw geminiApiError("Polling the Veo operation failed.", error);
    }

    return (
      settledResult(operation, generation.model) ?? inProgressResult(operationName, generation.model)
    );
  }

  function inProgressResult(operationName: string, model: string): AssetGenerationProviderResult {
    return {
      provider: providerID,
      model,
      status: "in_progress",
      providerJobId: operationName,
      providerGenerationId: operationName,
      providerPollingUrl: operationName,
      outputs: [],
      metadata: { provider: providerID, api: "generateVideos" },
    };
  }

  function failedResult(model: string, message: string): AssetGenerationProviderResult {
    return {
      provider: providerID,
      model,
      status: "failed",
      outputs: [],
      error: { message },
      metadata: { provider: providerID, api: "generateVideos" },
    };
  }

  // A completed or failed operation mapped to a provider result; undefined
  // while it is still running.
  function settledResult(
    operation: GenerateVideosOperation,
    model: string,
  ): AssetGenerationProviderResult | undefined {
    if (!operation.done) {
      return undefined;
    }
    if (operation.error) {
      return failedResult(model, stringValue(toJsonObject(operation.error).message) ?? "Veo returned an error.");
    }
    const video = operation.response?.generatedVideos?.[0]?.video;
    if (!video || (!video.videoBytes && !video.uri)) {
      const filtered = operation.response?.raiMediaFilteredReasons?.[0];
      return failedResult(model, filtered ?? "Veo returned no video for this request.");
    }
    const generationId = operation.name ?? `veo-${Date.now()}`;
    const output: GenerationOutputRef = {
      id: `${generationId}-video-0`,
      kind: "video",
      contentType: video.mimeType ?? "video/mp4",
      filename: `${generationId}-0.mp4`,
      metadata: { source: "provider-output" },
      ...(video.videoBytes ? { dataBase64: video.videoBytes } : { url: video.uri }),
    };
    return {
      provider: providerID,
      model,
      status: "completed",
      outputs: [output],
      metadata: { provider: providerID, api: "generateVideos" },
    };
  }

  return {
    id: providerID,
    configured,
    capabilities: ["video"],
    listModels,
    generateAsset,
    refreshAsset,
  };
}

type InlineImage = { data: string; mimeType: string };

// The video tools send a seed frame as inputs.images = [{ data, mimeType }]
// and identity anchors as inputs.referenceImages, the same shapes Omni's
// adapter reads.
function firstInlineImage(list: unknown): InlineImage | undefined {
  return inlineImages(list)[0];
}

function inlineImages(list: unknown): InlineImage[] {
  if (!Array.isArray(list)) {
    return [];
  }
  const out: InlineImage[] = [];
  for (const item of list) {
    if (!isJsonObject(item)) {
      continue;
    }
    const data = stringValue(item.data);
    if (!data) {
      continue;
    }
    out.push({ data, mimeType: stringValue(item.mimeType) ?? "image/png" });
  }
  return out;
}
