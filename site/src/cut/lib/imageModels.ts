// The image-model registry: which models render, and what each is called in
// the UI. Pure data (no store, no browser) — mirrors videoModels.ts.

import { geminiModels } from "@/lib/inference/gemini-models";

export type ImageTier = "flash" | "pro";

export interface ImageModelOption {
  tier: ImageTier;
  /** Shown in the model picker, banana emoji and all — matches how the
   * provider itself names these in its own apps. */
  label: string;
  /** The provider's own model id, sent with the generate request. */
  modelId: string;
}

export const IMAGE_MODELS: ImageModelOption[] = [
  { tier: "flash", label: "Nano Banana", modelId: geminiModels.flashImage },
  { tier: "pro", label: "Nano Banana Pro", modelId: geminiModels.proImage },
];

/** The registry entry for a tier — the single source of truth for what that
 * model is called and which id it sends. */
export function imageModel(tier: ImageTier): ImageModelOption {
  return IMAGE_MODELS.find((m) => m.tier === tier) ?? IMAGE_MODELS[0];
}
