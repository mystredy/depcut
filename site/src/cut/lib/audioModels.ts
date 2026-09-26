import { elevenLabsModels } from "@/lib/inference/elevenlabs-models";
import { geminiTtsModels } from "@/lib/inference/gemini-models";

// Text-to-speech model catalog (ai/text-to-speech's Audio Model picker).
// Gemini speaks through DepCut's own persona catalog (voices.ts); ElevenLabs
// speaks through its own account voice catalog (listVoices, fetched from
// /api/inference/voices) — the picker below only decides which backend and
// which billed model a generation uses, not which voice.
export type AudioModel = {
  id: string;
  provider: "gemini" | "elevenlabs";
  model: string;
  label: string;
  description: string;
  badge?: string;
};

export const AUDIO_MODELS: AudioModel[] = [
  {
    id: "gemini",
    provider: "gemini",
    model: geminiTtsModels.flash,
    label: "DepCut Voices",
    description: "Fast hosted speech with DepCut's built-in cast and delivery directions.",
  },
  {
    id: "eleven_v3",
    provider: "elevenlabs",
    model: elevenLabsModels.speechV3,
    label: "Eleven v3",
    description: "Latest ElevenLabs model with natural speech and high emotional range.",
  },
  {
    id: "eleven_multilingual_v2",
    provider: "elevenlabs",
    model: elevenLabsModels.speechMultilingualV2,
    label: "Eleven Multilingual v2",
    badge: "Popular",
    description: "High-quality multilingual voice-over generation.",
  },
];

export const DEFAULT_AUDIO_MODEL = AUDIO_MODELS[0].id;

export function resolveAudioModel(id?: string): AudioModel {
  return AUDIO_MODELS.find((m) => m.id === id) ?? AUDIO_MODELS[0];
}
