import { hostedPost } from "./hosted";

type TranscriptionRecordBase = {
  sourceType: "upload" | "record" | "social" | "source";
  sourceLabel: string;
  fileMime?: string;
  fileSizeBytes?: number;
  language?: string;
  tagAudioEvents: boolean;
  noVerbatim: boolean;
  diarize: boolean;
  keyterms: string[];
};

export type TranscriptionRecord =
  | (TranscriptionRecordBase & { status: "succeeded"; transcript: string })
  | (TranscriptionRecordBase & { status: "failed"; errorMessage: string });

/** Best-effort: save a just-settled Speech to Text run (succeeded or failed)
 * to the database — the only place a run is recorded, shown back on the
 * page as Generations (see TranscriptionAccountHistory.tsx). A failure
 * here never surfaces to the user: they already have their transcript (or
 * error) either way. */
export async function persistTranscription(record: TranscriptionRecord): Promise<void> {
  try {
    await hostedPost("/api/transcriptions", record);
  } catch {
    // Best-effort — see doc comment above.
  }
}
