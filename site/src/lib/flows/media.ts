// A Flow generation's R2 object as a browser-facing URL. Uses r2.ts's plain
// presigned GET (not the media Worker's signed-token scheme in mediaCdn.ts —
// that scheme's tree-token depth recovery assumes a `cut/`-rooted key, and a
// Flow's `flows/` prefix is deliberately outside that) — a private,
// time-limited URL good for one page view, re-minted on every list/detail
// read, same tradeoff marketplace submissions already make.
import { presignGet } from "@/cut/server/cloud/r2";

export function flowMediaUrl(key: string): Promise<string> {
  return presignGet(key);
}
