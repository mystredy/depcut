import { hostedPost } from "./hosted";

export type VisualGenerationRecordBase = {
  prompt: string;
  aspect: string;
  tier: string;
};

export type VisualGenerationRecord =
  | (VisualGenerationRecordBase & { status: "succeeded"; blob: Blob; durationSeconds?: number })
  | (VisualGenerationRecordBase & { status: "failed"; errorMessage: string });

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = String(r.result);
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(blob);
  });
}

/** Best-effort: save a just-settled Text to Video take (succeeded or failed)
 * to the database — the only place a take is recorded, shown back on the
 * page as Generations. Called once per take, right after it settles. A
 * failure here never surfaces to the user: they already have their render
 * (or error) either way. */
export async function persistVisualGeneration(record: VisualGenerationRecord): Promise<void> {
  try {
    if (record.status === "failed") {
      await hostedPost("/api/visual-generations", record);
      return;
    }
    const { blob, ...rest } = record;
    const dataBase64 = await blobToBase64(blob);
    await hostedPost("/api/visual-generations", {
      ...rest,
      dataBase64,
      mimeType: blob.type || "video/mp4",
    });
  } catch {
    // Best-effort — see doc comment above.
  }
}
