import type { AiModality } from "@/lib/ai-models-seed";
import { prisma } from "@/lib/prisma";
import {
  API_INTEGRATION_DEFAULT_BASE_URLS,
  API_INTEGRATION_ENV_VARS,
  API_INTEGRATION_LABELS,
  API_INTEGRATION_MODALITIES,
  type ApiIntegrationProvider,
} from "@/lib/marketplace/api-integrations-seed";

// Live "what models does this provider actually offer" discovery for the AI
// Models admin page's Add-model dialog — a real network call to the
// provider's own catalog, not this app's own registries (those only list
// what's already wired into a picker; see ai-models-seed.ts).
//
// The key used is whichever the provider's real adapter would use: its env
// var first (see api-integrations-seed.ts's ENV_VARS), falling back to the
// ApiIntegration row's own stored key for a provider with no adapter yet
// (anthropic, open_router) or as a last resort. Gemini's real generation
// path is Vertex service-account OAuth, not this key — but the public
// Generative Language API's own models.list works with a plain API key, so
// that's what discovery uses; it doesn't need to match how a render is
// actually authenticated.

export type ProviderModel = { id: string; name: string };

const TIMEOUT_MS = 10_000;

async function resolveApiKey(provider: ApiIntegrationProvider): Promise<string | null> {
  for (const envVar of API_INTEGRATION_ENV_VARS[provider]) {
    const value = process.env[envVar]?.trim();
    if (value) return value;
  }
  const row = await prisma.apiIntegration.findUnique({
    select: { apiKey: true },
    where: { provider },
  });
  return row?.apiKey?.trim() || null;
}

// Sorts a provider's raw catalog entry into one of our four admin modality
// buckets, or null to leave it out entirely (embeddings, moderation, and
// anything else that isn't a chat/image/video/audio model). Id-pattern based
// since none of these providers' models.list responses carry a modality
// field we can just read — patterns mirror the real ids this codebase's own
// adapters use (see gemini-models.ts, openai-models.ts).
function classifyProviderModel(provider: ApiIntegrationProvider, id: string): AiModality | null {
  switch (provider) {
    case "gemini": {
      if (/embedding|aqa/i.test(id)) return null;
      if (id.includes("omni") || id.includes("veo")) return "video";
      if (id.includes("-image") || id.startsWith("imagen")) return "image";
      if (id.includes("-tts") || id.startsWith("lyria")) return "audio";
      return id.startsWith("gemini") ? "chat" : null;
    }
    case "openai": {
      if (/embedding|moderation/i.test(id)) return null;
      if (id.startsWith("sora")) return "video";
      if (id.startsWith("dall-e") || id.startsWith("gpt-image")) return "image";
      if (id.startsWith("whisper") || id.startsWith("tts-") || /transcribe|-tts/.test(id)) {
        return "audio";
      }
      return id.startsWith("gpt-") || id.startsWith("chatgpt") || /^o[0-9]/.test(id) ? "chat" : null;
    }
    // These providers each do exactly one thing this app cares about — every
    // model in their catalog counts, no id pattern needed.
    case "anthropic":
      return "chat";
    case "elevenlabs":
      return "audio";
    case "open_router":
      return "chat";
    default:
      return null;
  }
}

export async function listProviderModels(
  provider: ApiIntegrationProvider,
  modality: AiModality,
): Promise<ProviderModel[]> {
  if (!API_INTEGRATION_MODALITIES[provider].includes(modality)) {
    throw new Error(`${API_INTEGRATION_LABELS[provider]} doesn't offer ${modality} models.`);
  }
  if (provider === "fal_ai") {
    throw new Error("Fal.ai doesn't publish a model-discovery endpoint — add its models manually.");
  }

  const apiKey = await resolveApiKey(provider);
  if (!apiKey) {
    throw new Error("No API key is configured for this provider yet.");
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const models = await fetchCatalog(provider, apiKey, signal);
  return models.filter((m) => classifyProviderModel(provider, m.id) === modality);
}

async function fetchCatalog(
  provider: ApiIntegrationProvider,
  apiKey: string,
  signal: AbortSignal,
): Promise<ProviderModel[]> {
  switch (provider) {
    case "openai": {
      const res = await fetch(`${API_INTEGRATION_DEFAULT_BASE_URLS.openai}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      });
      if (!res.ok) throw new Error(`OpenAI returned ${res.status}.`);
      const body = (await res.json()) as { data?: { id: string }[] };
      return (body.data ?? []).map((m) => ({ id: m.id, name: m.id }));
    }
    case "anthropic": {
      const res = await fetch(`${API_INTEGRATION_DEFAULT_BASE_URLS.anthropic}/models`, {
        headers: { "anthropic-version": "2023-06-01", "x-api-key": apiKey },
        signal,
      });
      if (!res.ok) throw new Error(`Anthropic returned ${res.status}.`);
      const body = (await res.json()) as { data?: { id: string; display_name?: string }[] };
      return (body.data ?? []).map((m) => ({ id: m.id, name: m.display_name ?? m.id }));
    }
    case "elevenlabs": {
      const res = await fetch(`${API_INTEGRATION_DEFAULT_BASE_URLS.elevenlabs}/models`, {
        headers: { "xi-api-key": apiKey },
        signal,
      });
      if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}.`);
      const body = (await res.json()) as { model_id?: string; name?: string }[];
      const out: ProviderModel[] = [];
      for (const m of Array.isArray(body) ? body : []) {
        if (m.model_id) out.push({ id: m.model_id, name: m.name ?? m.model_id });
      }
      return out;
    }
    case "gemini": {
      const url = new URL(`${API_INTEGRATION_DEFAULT_BASE_URLS.gemini}/models`);
      url.searchParams.set("key", apiKey);
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Gemini returned ${res.status}.`);
      const body = (await res.json()) as { models?: { name: string; displayName?: string }[] };
      return (body.models ?? []).map((m) => ({
        id: m.name.replace(/^models\//, ""),
        name: m.displayName ?? m.name,
      }));
    }
    case "open_router": {
      const res = await fetch(`${API_INTEGRATION_DEFAULT_BASE_URLS.open_router}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      });
      if (!res.ok) throw new Error(`OpenRouter returned ${res.status}.`);
      const body = (await res.json()) as { data?: { id: string; name?: string }[] };
      return (body.data ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id }));
    }
    default:
      throw new Error("Unsupported provider.");
  }
}
