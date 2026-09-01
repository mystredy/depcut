// An AudioGeneration's R2 object as a browser-facing URL. Same plain
// presigned-GET tradeoff as flows/media.ts's flowMediaUrl: private,
// time-limited, re-minted on every list/detail read.
import { presignGet } from "@/cut/server/cloud/r2";

export function audioGenerationUrl(key: string): Promise<string> {
  return presignGet(key);
}
