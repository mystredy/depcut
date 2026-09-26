"use client";

// ElevenLabs' own voice catalog, fetched from the account (unlike Gemini's
// fixed persona set — see voices.ts) — the ai/text-to-speech page's
// ElevenLabs voice picker reads this. A voice's `labels` (gender, accent,
// age, use case, …) come straight from ElevenLabs, not a DepCut catalog.
export type ElevenLabsVoice = {
  id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  previewUrl?: string;
};

let cache: Promise<ElevenLabsVoice[]> | null = null;

/** The account's voices (no `query`), fetched once per page load and reused
 * by every mounted picker; a `query` instead looks up a voice by exact id or
 * searches ElevenLabs' public voice library by name — the "+" add flow —
 * and is never cached, since each search's result is one-off. */
export function fetchElevenLabsVoices(query?: string): Promise<ElevenLabsVoice[]> {
  const q = query?.trim();
  const fetchOnce = () =>
    fetch(`/api/inference/voices?provider=elevenlabs${q ? `&q=${encodeURIComponent(q)}` : ""}`, {
      headers: { "x-depcut-client-id": "depcut-cut" },
    }).then(async (res) => {
      if (!res.ok) throw new Error("Could not load ElevenLabs voices.");
      const body = (await res.json()) as { data?: ElevenLabsVoice[] };
      return body.data ?? [];
    });

  if (q) return fetchOnce();

  cache ??= fetchOnce().catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}
