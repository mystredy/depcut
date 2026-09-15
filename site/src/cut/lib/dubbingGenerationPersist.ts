import { hostedPost } from "./hosted";
import { blobToInlineAudio } from "./refMedia";

export type DubbingGenerationRecord = {
  script: string;
  voice: string;
  direction?: string;
  language?: string;
  sourceLabel?: string;
  transcript?: string;
  targetLanguage?: string;
};

/** Best-effort: save a just-rendered Dubbing clip to the admin's Content →
 * Audio list. Called right after renderSpeechClip succeeds, alongside — not
 * instead of — whatever the page itself does with the blob (playing it,
 * offering a download, the opt-in "Add to library"). A failure here never
 * surfaces to the user: they already have their clip either way, this is
 * purely site-side visibility. */
export async function persistDubbingGeneration(blob: Blob, record: DubbingGenerationRecord): Promise<void> {
  try {
    const inline = await blobToInlineAudio(blob);
    if (!inline) return;
    await hostedPost("/api/dubbing-generations", {
      ...record,
      dataBase64: inline.data,
      mimeType: inline.mimeType,
    });
  } catch {
    // Best-effort — see doc comment above.
  }
}
