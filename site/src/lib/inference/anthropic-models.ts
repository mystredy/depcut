// Central registry of Anthropic model IDs the gateway runs (mirrors gemini-models.ts /
// openai-models.ts). Anything the code selects lives here so it is priced exhaustively in
// provider-pricing.ts; bumping a model is a one-line change here.
export const anthropicModels = {
  // The Cut chat agent's hosted Claude option (anthropic-responses.ts).
  chat: "claude-sonnet-5",
} as const;

export type AnthropicRunModel = (typeof anthropicModels)[keyof typeof anthropicModels];
