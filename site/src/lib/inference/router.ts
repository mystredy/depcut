import { createAnthropicResponsesProvider } from "@/lib/inference/adapters/anthropic-responses";
import { createAudioAssetProvider } from "@/lib/inference/adapters/audio-studio";
import { createGeminiComputerUseProvider } from "@/lib/inference/adapters/gemini-computer-use";
import { createGeminiImageAssetProvider } from "@/lib/inference/adapters/gemini-image";
import { createGeminiMusicAssetProvider } from "@/lib/inference/adapters/gemini-music";
import { createGeminiSpeechAssetProvider } from "@/lib/inference/adapters/gemini-speech";
import { createGeminiOmniVideoAssetProvider } from "@/lib/inference/adapters/gemini-omni-video";
import { createGeminiVeoVideoAssetProvider } from "@/lib/inference/adapters/gemini-veo-video";
import { createHostedResponsesProvider } from "@/lib/inference/adapters/hosted-responses";
import { createOpenAIChatResponsesProvider } from "@/lib/inference/adapters/openai-chat-responses";
import {
  InferenceProviderError,
  type AssetGenerationRequest,
  type InferenceModality,
  type InferenceModel,
  type InferenceProvider,
  type JsonValue,
  type ResponseCreateRequest,
  type StoredGenerationForProvider,
} from "@/lib/inference/providers";

// Input part types that carry audio/video media. Only a provider that declares handlesResponseMedia
// can render these, so the router uses this to route media requests by capability.
const mediaPartTypes = new Set(["input_audio", "input_video", "audio", "video"]);

function responseRequestHasMedia(request: ResponseCreateRequest): boolean {
  const search = (value: JsonValue | undefined): boolean => {
    if (Array.isArray(value)) {
      return value.some(search);
    }
    if (value && typeof value === "object") {
      const type = (value as Record<string, JsonValue>).type;
      if (typeof type === "string" && mediaPartTypes.has(type)) {
        return true;
      }
      return Object.values(value as Record<string, JsonValue>).some(search);
    }
    return false;
  };
  return search(request.body.input as JsonValue | undefined);
}

export class ProviderRegistry {
  private providers: InferenceProvider[];

  public constructor(providers: InferenceProvider[]) {
    this.providers = providers;
  }

  public async listModels(modalities: InferenceModality[]) {
    const configuredProviders = this.providers.filter((provider) => provider.configured);
    if (configuredProviders.length === 0) {
      throw new InferenceProviderError("No configured inference provider is available.", {
        statusCode: 503,
        code: "no_inference_provider",
      });
    }

    // One provider failing to enumerate its models (e.g. an API key missing a list permission)
    // must not take down the combined catalog — skip it and keep the models from the rest.
    const results: InferenceModel[] = [];
    for (const provider of configuredProviders) {
      results.push(...(await provider.listModels(modalities)));
    }

    return dedupeModels(results);
  }

  public textProvider(stream: boolean) {
    const provider = this.providers.find((candidate) => {
      return candidate.configured && (stream ? candidate.streamCompletion : candidate.completeText);
    });

    if (!provider) {
      throw new InferenceProviderError("No configured text inference provider is available.", {
        statusCode: 503,
        code: "no_text_provider",
      });
    }

    return provider;
  }

  public responsesProvider(request?: ResponseCreateRequest) {
    if (request?.depcutProvider) {
      const provider = this.providers.find((candidate) => {
        return (
          Boolean(candidate.createResponse) &&
          Boolean(candidate.responseProviderIDs?.includes(request.depcutProvider ?? "")) &&
          candidate.canCreateResponse?.(request) !== false
        );
      });

      if (!provider) {
        throw new InferenceProviderError("Requested Responses provider is unavailable.", {
          statusCode: 404,
          code: "provider_not_found",
          details: { provider: request.depcutProvider },
        });
      }

      if (!provider.configured) {
        throw new InferenceProviderError("Requested Responses provider is not configured.", {
          statusCode: 503,
          code: "missing_provider_credentials",
          details: { provider: request.depcutProvider },
        });
      }

      return provider;
    }

    const mediaRequest = request ? responseRequestHasMedia(request) : false;
    const provider = this.providers.find((candidate) => {
      return (
        candidate.configured &&
        Boolean(candidate.createResponse) &&
        (request ? candidate.canCreateResponse?.(request) !== false : true) &&
        // A request with audio/video parts must go to a provider that positively handles media,
        // so it is never routed to one (current or future) that would silently drop the media.
        (mediaRequest && request ? candidate.handlesResponseMedia?.(request) === true : true)
      );
    });

    if (!provider) {
      if (mediaRequest) {
        throw new InferenceProviderError(
          "No configured Responses provider can handle audio/video input.",
          { statusCode: 415, code: "no_media_responses_provider" },
        );
      }
      throw new InferenceProviderError("No configured Responses provider is available.", {
        statusCode: 503,
        code: "no_responses_provider",
      });
    }

    return provider;
  }

  public assetProvider(request: AssetGenerationRequest) {
    if (request.provider) {
      const provider = this.providers.find((candidate) => candidate.id === request.provider);
      if (!provider || !provider.generateAsset) {
        throw new InferenceProviderError("Requested inference provider is unavailable.", {
          statusCode: 404,
          code: "provider_not_found",
        });
      }

      if (!provider.configured) {
        throw new InferenceProviderError("Requested inference provider is not configured.", {
          statusCode: 503,
          code: "missing_provider_credentials",
        });
      }

      return provider;
    }

    const preferredCapabilities =
      request.kind === "music"
        ? ["music", "audio"]
        : request.kind === "speech"
          ? ["speech", "audio"]
          : [request.kind];

    const provider = this.providers.find((candidate) => {
      return (
        candidate.configured &&
        Boolean(candidate.generateAsset) &&
        preferredCapabilities.some((capability) => {
          return candidate.capabilities.includes(capability as InferenceModality);
        })
      );
    });

    if (!provider) {
      throw new InferenceProviderError("No configured asset generation provider is available.", {
        statusCode: 503,
        code: "no_asset_provider",
      });
    }

    return provider;
  }

  public providerForGeneration(generation: StoredGenerationForProvider) {
    const provider = this.providers.find((candidate) => candidate.id === generation.provider);
    if (!provider) {
      throw new InferenceProviderError("Generation provider is unavailable.", {
        statusCode: 404,
        code: "provider_not_found",
      });
    }

    if (!provider.configured) {
      throw new InferenceProviderError("Generation provider is not configured.", {
        statusCode: 503,
        code: "missing_provider_credentials",
      });
    }

    return provider;
  }

  /** A configured provider by id, or undefined — for a capability the router
   * has no request shape for (e.g. voice listing), where the caller already
   * knows which provider it wants. */
  public byID(id: string): InferenceProvider | undefined {
    return this.providers.find((candidate) => candidate.configured && candidate.id === id);
  }

  public async refresh(generation: StoredGenerationForProvider) {
    const provider = this.providerForGeneration(generation);
    if (!provider.refreshAsset) {
      throw new InferenceProviderError("Generation provider cannot refresh assets.", {
        statusCode: 400,
        code: "refresh_not_supported",
      });
    }

    return provider.refreshAsset(generation);
  }
}

export function createProviderRegistry() {
  return new ProviderRegistry([
    // Asset selection is by capability + generateAsset, not list order: the image asset
    // provider serves kind="image" (gemini-computer-use lists "image" as an input modality
    // but has no generateAsset, so it is never chosen for asset generation).
    createGeminiImageAssetProvider(),
    // Omni (Gemini Omni Flash) serves kind="video"; its distinct provider id
    // keeps async refresh routing from colliding with the synchronous image
    // adapter.
    createGeminiOmniVideoAssetProvider(),
    // Veo 3.1 (Lite/Fast/Quality) also serves kind="video", on the
    // long-running generateVideos API instead of Omni's Interactions API. Its
    // own provider id keeps refresh routing and pricing separate from Omni;
    // the video panel always names a provider explicitly (see videoModels.ts),
    // so capability-based fallback never has to pick between the two.
    createGeminiVeoVideoAssetProvider(),
    // Gemini TTS is the default kind="speech" provider (voiceovers, subtitle
    // read-alouds) — listed ahead of ElevenLabs below so it wins that
    // capability fallback whenever a speech request names no provider.
    createGeminiSpeechAssetProvider(),
    // Gemini/Lyria is the default kind="music" provider — the Audio-tab
    // generator, generate_music, and the brief-to-video bed. It runs on the
    // always-hosted Vertex service account, so music never falls back to
    // another provider by itself. The adapter picks the clip or the longer
    // pro model from the requested length so a bed can still span a longer
    // video (see gemini-music.ts).
    createGeminiMusicAssetProvider(),
    // ElevenLabs (audio-studio.ts): reached only by an explicit
    // request.provider = "elevenlabs" — for speech (ai/text-to-speech's
    // Audio Model picker) and, later, its own music modes. Listed after both
    // Gemini asset providers above so neither's capability fallback ever
    // picks it by accident; its own capabilities list stays music-only for
    // the same reason (see audio-studio.ts's comment).
    createAudioAssetProvider(),
    createGeminiComputerUseProvider(),
    // General hosted chat/tool-calling for the Cut AI panel's GPT and Claude
    // model options — ahead of hosted-responses (its narrow debug-inspection
    // canCreateResponse already excludes everything else, but this keeps the
    // intent obvious: the general adapter is the default "openai" match).
    createOpenAIChatResponsesProvider(),
    createAnthropicResponsesProvider(),
    createHostedResponsesProvider(),
  ]);
}

function dedupeModels(models: InferenceModel[]) {
  const seen = new Set<string>();
  const result: InferenceModel[] = [];
  for (const model of models) {
    const key = `${model.provider}:${model.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(model);
  }

  return result;
}
