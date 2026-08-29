// The video-model registry: which models render, and what each supports.
// Pure data + lookups (no store, no browser), so the genvideo self-test can
// exercise everything that reads constraints from here.

import {
  geminiOmniMaxReferenceImages,
  geminiOmniModels,
  geminiVeoModels,
} from "@/lib/inference/gemini-models";

/** The shape the next generated clip is composed in — landscape or portrait. */
export type VideoAspect = "16:9" | "9:16";

/** A render's resolution — the option set each tier accepts differs (see
 * GeneratePanel's RESOLUTION_OPTIONS), so this union just spans all of them. */
export type VideoResolution = "360p" | "720p" | "1080p";

export const VIDEO_ASPECT_LABEL: Record<VideoAspect, string> = {
  "16:9": "Landscape (16:9)",
  "9:16": "Portrait (9:16)",
};

/** A selectable video model. Every tier takes text plus an optional seed or
 * reference images and returns the whole clip with audio in one pass, plus a
 * resolution and duration pick. Veo's are documented API parameters; Omni's
 * ride the same undocumented field its task already does and may go ignored
 * (see gemini-omni-video.ts). Omni runs on its own Interactions-API provider;
 * the three Veo 3.1 tiers share the generateVideos provider and trade render
 * time for quality at different price points. Adding a tier here plus its
 * price (provider-pricing.ts) is the whole client-side change. */
export type VideoTier = "omni" | "veo-lite" | "veo-fast" | "veo-quality";

export interface VideoModelOption {
  tier: VideoTier;
  /** Segment label and the model name shown beside it (equal for a
   * single-model entry). */
  word: string;
  model: string;
  /** Which asset-generation provider renders this tier (router.ts). */
  provider: string;
  /** The provider's own model id, sent with the generate request. */
  modelId: string;
  /** Identity reference images a render accepts alongside the prompt. */
  maxReferenceImages: number;
  aspects: VideoAspect[];
}

export const VIDEO_MODELS: VideoModelOption[] = [
  {
    tier: "omni",
    word: "Omni 1.1 Flash",
    model: "Omni 1.1 Flash",
    provider: "gemini-omni",
    modelId: geminiOmniModels.flashVideo,
    maxReferenceImages: geminiOmniMaxReferenceImages,
    aspects: ["16:9", "9:16"],
  },
  {
    tier: "veo-lite",
    word: "Veo 3.1 - Lite",
    model: "Veo 3.1 - Lite",
    provider: "gemini-veo",
    modelId: geminiVeoModels.lite,
    maxReferenceImages: 3,
    aspects: ["16:9", "9:16"],
  },
  {
    tier: "veo-fast",
    word: "Veo 3.1 - Fast",
    model: "Veo 3.1 - Fast",
    provider: "gemini-veo",
    modelId: geminiVeoModels.fast,
    maxReferenceImages: 3,
    aspects: ["16:9", "9:16"],
  },
  {
    tier: "veo-quality",
    word: "Veo 3.1 - Quality",
    model: "Veo 3.1 - Quality",
    provider: "gemini-veo",
    modelId: geminiVeoModels.quality,
    maxReferenceImages: 3,
    aspects: ["16:9", "9:16"],
  },
];

/** The registry entry for a tier — the single source of truth for what that
 * model supports. Any code that generates video (the panel, the scene pipeline)
 * reads its constraints from here, so swapping models is one edit in this file. */
export function videoModel(tier: VideoTier): VideoModelOption {
  return VIDEO_MODELS.find((m) => m.tier === tier) ?? VIDEO_MODELS[0];
}

/** The default model's supported shapes — what AI-path renders and pipeline
 * seeds clamp the project aspect onto when no tier was picked. */
export function defaultVideoAspects(): VideoAspect[] {
  return VIDEO_MODELS[0].aspects;
}

/**
 * Composition guidance for a project the renderer can't shoot natively. The
 * models render 16:9 or 9:16 only, so a project on any other ratio gets a clip
 * of a different shape than its frame. A clip letterboxes by default (`fit`
 * defaults to "fit"), and filling the frame instead — the Inspector's Fill, the
 * usual next move — crops whatever sits outside a centered slice. Naming the
 * target shape keeps the subject inside the part that survives either way.
 * Empty when the project already is a shape the model renders, so those prompts
 * stay exactly as written.
 */
export function aspectFramingNote(projectAspect: string, renderAspect: VideoAspect): string {
  if ((defaultVideoAspects() as string[]).includes(projectAspect)) return "";
  return (
    `Compose for a ${projectAspect} frame. This renders ${renderAspect}, a different shape, and sits ` +
    `in a ${projectAspect} project where it may be cropped to fill the frame — so keep the subject ` +
    `and any important action within a centered ${projectAspect} area, clear of the edges.`
  );
}
