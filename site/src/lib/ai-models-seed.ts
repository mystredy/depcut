// The chat/image/video/audio models the AiModel table self-seeds from on
// first read — one row per entry, derived straight from the same registries
// the client composers already read (videoModels.ts, imageModels.ts) so this
// list can never drift from what's actually selectable. Chat and audio have
// no per-request model choice anywhere yet (see cutAgent.ts/prodDeps.ts,
// audioGen.ts, tts.ts), so their entries exist for admin visibility only,
// not enforcement.
import { geminiModels, geminiMusicModels, geminiTtsModels } from "@/lib/inference/gemini-models";
import { IMAGE_MODELS } from "@/cut/lib/imageModels";
import { VIDEO_MODELS } from "@/cut/lib/videoModels";

export const AI_MODALITIES = ["chat", "image", "video", "audio"] as const;

export type AiModality = (typeof AI_MODALITIES)[number];

export type AiModelSeedEntry = {
  modality: AiModality;
  tier: string;
  label: string;
  modelId: string;
};

const CHAT_MODEL_SEED: AiModelSeedEntry[] = [
  { modality: "chat", tier: "flash", label: "Gemini Flash", modelId: geminiModels.flash },
  { modality: "chat", tier: "flash-lite", label: "Gemini Flash Lite", modelId: geminiModels.flashLite },
];

const AUDIO_MODEL_SEED: AiModelSeedEntry[] = [
  { modality: "audio", tier: "tts-flash", label: "Gemini TTS Flash", modelId: geminiTtsModels.flash },
  { modality: "audio", tier: "music-clip", label: "Lyria Clip", modelId: geminiMusicModels.clip },
  { modality: "audio", tier: "music-song", label: "Lyria Full Track", modelId: geminiMusicModels.pro },
];

export const AI_MODEL_SEED: AiModelSeedEntry[] = [
  ...CHAT_MODEL_SEED,
  ...AUDIO_MODEL_SEED,
  ...IMAGE_MODELS.map((m) => ({ modality: "image" as const, tier: m.tier, label: m.label, modelId: m.modelId })),
  ...VIDEO_MODELS.map((m) => ({ modality: "video" as const, tier: m.tier, label: m.word, modelId: m.modelId })),
];

export const aiModelKey = (modality: AiModality, tier: string) => `${modality}:${tier}`;
