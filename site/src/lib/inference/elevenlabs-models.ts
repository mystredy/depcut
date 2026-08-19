// Central registry of ElevenLabs model IDs the gateway runs (mirrors gemini-models.ts).
// Models the code selects live here so they are priced exhaustively in provider-pricing.ts.
export const elevenLabsModels = {
  // Music composition.
  music: "music_v1",
  // Speech-to-text (cut/server/cloud/transcribe.ts).
  scribe: "scribe_v2",
} as const;

export type ElevenLabsRunModel = (typeof elevenLabsModels)[keyof typeof elevenLabsModels];
