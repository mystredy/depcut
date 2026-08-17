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

// The env var(s) each provider's real key actually comes from — this table
// is storage/reference only (see the module doc comment above), so the
// admin panel reads these to tell the operator whether the key that's
// actually in effect is set, rather than implying this table's own value
// matters. Gemini's adapter falls back to GOOGLE_API_KEY if GEMINI_API_KEY
// isn't set, so both are listed.
export const API_INTEGRATION_ENV_VARS: Record<ApiIntegrationProvider, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  elevenlabs: ["ELEVENLABS_API_KEY"],
  fal_ai: ["FAL_AI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  open_router: ["OPENROUTER_API_KEY"],
  openai: ["OPENAI_API_KEY"],
};

// Whether any adapter in this codebase actually calls the provider yet.
// anthropic/fal_ai/open_router have env vars reserved and a row in this
// table, but nothing calls them today — set the key and it'll simply sit
// unused until that integration is built.
export const API_INTEGRATION_WIRED: Record<ApiIntegrationProvider, boolean> = {
  anthropic: false,
  elevenlabs: true,
  fal_ai: false,
  gemini: true,
  open_router: false,
  openai: true,
};
