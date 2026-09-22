// Deterministic per-id accent gradient — the same idea as a chat app coloring
// avatars by user id, so a list of otherwise-identical icons (a Generations
// card, a voice-picker row) doesn't read as one flat block, and a given id's
// color never changes across reloads. Shared by MediaGenerationHistory's
// cards and the ElevenLabs voice picker (ai-suite/text-to-speech).
const ACCENTS = [
  "from-orange-400 to-rose-400",
  "from-violet-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-blue-500",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-fuchsia-500",
];

export function accentFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}
