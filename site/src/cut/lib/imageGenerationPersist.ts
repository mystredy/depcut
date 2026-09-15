import { hostedPost } from "./hosted";

export type ImageGenerationRecordBase = {
  prompt: string;
  aspect: string;
  tier: string;
};

export type ImageGenerationRecord =
  | (ImageGenerationRecordBase & { status: "succeeded"; blob: Blob })
  | (ImageGenerationRecordBase & { status: "failed"; errorMessage: string });

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

/** Best-effort: save a just-settled Text to Image take (succeeded or failed)
 * to the database. Called once per take, right after it settles, alongside
 * — not instead of — the browser-local Recent History entry. A failure here
 * never surfaces to the user: they already have their render (or error)
 * either way. */
export async function persistImageGeneration(record: ImageGenerationRecord): Promise<void> {
  try {
    if (record.status === "failed") {
      await hostedPost("/api/image-generations", record);
      return;
    }
    const { blob, ...rest } = record;
    const dataBase64 = await blobToBase64(blob);
    await hostedPost("/api/image-generations", {
      ...rest,
      dataBase64,
      mimeType: blob.type || "image/png",
    });
  } catch {
    // Best-effort — see doc comment above.
  }
}
