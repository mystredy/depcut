import { hostedPost } from "./hosted";

type ScriptRecordBase = {
  topic: string;
  duration: string;
  platform: string;
  tone?: string;
};

export type ScriptRecord =
  | (ScriptRecordBase & { status: "succeeded"; script: string })
  | (ScriptRecordBase & { status: "failed"; errorMessage: string });

/** Best-effort: save a just-settled Scripting run (succeeded or failed) to
 * the database. Called right after the run settles, alongside — not instead
 * of — the browser-local Recent History entry. A failure here never
 * surfaces to the user: they already have their script (or error) either
 * way. */
export async function persistScript(record: ScriptRecord): Promise<void> {
  try {
    await hostedPost("/api/scripts", record);
  } catch {
    // Best-effort — see doc comment above.
  }
}
