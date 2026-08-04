// External AI provider credentials. The ApiIntegration table self-seeds one
// disabled row per provider from this list on first read — see
// /api/admin/api-integrations. Storage only: the real inference adapters
// (src/lib/inference/adapters/*, src/cut/lib/genvideo/adapters/music.ts)
// still read their keys from environment variables, not from this table.
export const API_INTEGRATION_SEED = [
  "openai",
  "gemini",
  "anthropic",
  "fal_ai",
  "open_router",
  "elevenlabs",
] as const;

export type ApiIntegrationProvider = (typeof API_INTEGRATION_SEED)[number];

export const API_INTEGRATION_LABELS: Record<ApiIntegrationProvider, string> = {
  anthropic: "Anthropic",
  elevenlabs: "ElevenLabs",
  fal_ai: "Fal AI",
  gemini: "Gemini",
  open_router: "Open Router",
  openai: "OpenAI",
};

export const API_INTEGRATION_DEFAULT_BASE_URLS: Record<ApiIntegrationProvider, string> = {
  anthropic: "https://api.anthropic.com/v1",
  elevenlabs: "https://api.elevenlabs.io/v1",
  fal_ai: "https://fal.run",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  open_router: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
};
