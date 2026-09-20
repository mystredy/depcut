import { geminiModels } from "@/lib/inference/gemini-models";
import { openaiModels } from "@/lib/inference/openai-models";
import { anthropicModels } from "@/lib/inference/anthropic-models";

export interface AiModel {
  id: string;
  label: string;
  provider: "claude" | "codex" | "gemini" | "openai" | "anthropic" | "test";
  hidden?: boolean;
}

/** The assistant's model catalog. It lives in the page so a site deploy
 * updates every user's picker immediately; the engine never sees this list —
 * chat passes the chosen id straight to the provider CLI or hosted route, so
 * new models work against older installed engines too.
 * Claude/Codex ids route through a local CLI on this Mac (verified against
 * it) and need the engine connected. Gemini/OpenAI/Anthropic run through
 * DepCut's hosted inference (sign-in + credits) instead — no local app
 * required, which is also why their ids can't collide with the CLI ones
 * above: "claude-sonnet-5-hosted" and "claude-sonnet-5" pick different
 * providers for the exact same underlying model. */
export const AI_MODELS: AiModel[] = [
  { id: "claude-fable-5", label: "Fable 5", provider: "claude" },
  { id: "claude-opus-5", label: "Opus 5", provider: "claude" },
  { id: "claude-sonnet-5", label: "Sonnet 5", provider: "claude" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", provider: "claude" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", provider: "codex" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "codex" },
  { id: "gpt-5.5", label: "GPT-5.5", provider: "codex" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", provider: "codex" },
  { id: geminiModels.flash, label: "Gemini Flash", provider: "gemini" },
  { id: `${openaiModels.chat}-hosted`, label: "GPT-5.5", provider: "openai" },
  { id: `${anthropicModels.chat}-hosted`, label: "Sonnet 5", provider: "anthropic" },
  // Hermetic test provider for e2e runs — hidden unless enabled in the UI.
  { id: "cut-test", label: "Test model", provider: "test", hidden: true },
];
