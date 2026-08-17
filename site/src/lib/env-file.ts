import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env");

// Sets (or appends) several KEY="value" lines in the local .env file in one
// read-modify-write pass. Local-dev convenience only, for admin panels that
// let an operator paste a key straight into the running server's own
// environment — a real production host's env usually isn't a writable file
// at all (secrets come from the platform's own dashboard), so this is
// expected to be a no-op there. Callers should treat failures as non-fatal:
// never let a broken env file write fail the request that triggered it.
//
// Batched on purpose: this does one read and one write for the whole set.
// Firing setEnvVar per key in parallel would race — each call reads the
// same starting content, so whichever write lands last wins and silently
// discards the others' changes.
export async function setEnvVars(entries: Record<string, string>): Promise<void> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return;
  let content = await readFile(ENV_PATH, "utf8").catch(() => "");
  for (const key of keys) {
    const line = `${key}="${entries[key].replace(/"/g, '\\"')}"`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
  }
  await writeFile(ENV_PATH, content, "utf8");
}

// Single-key convenience — still just one read-modify-write, safe on its
// own. Use setEnvVars instead when a caller might set more than one key for
// the same request.
export function setEnvVar(key: string, value: string): Promise<void> {
  return setEnvVars({ [key]: value });
}
