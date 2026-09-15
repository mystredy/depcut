import { visualGenerationKey } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";
import { putObject } from "@/cut/server/cloud/r2";

export type VisualTool = "text-to-image" | "text-to-video";

type CreateVisualBase = {
  userId: string;
  tool: VisualTool;
  prompt: string;
  aspect: string;
  tier: string;
};

export type CreateVisualInput =
  | (CreateVisualBase & {
      status: "succeeded";
      bytes: Buffer;
      mime: string;
      durationSeconds?: number;
    })
  | (CreateVisualBase & { status: "failed"; errorMessage: string });

/** Record a finished (succeeded or failed) Text to Image/Video run — called
 * once per take, right after it settles client-side (see
 * cut/lib/visualGenerationPersist.ts). A succeeded row uploads its bytes to
 * R2 first; a failed row has no media to store. */
export async function createVisualGeneration(input: CreateVisualInput): Promise<{ id: string }> {
  const id = crypto.randomUUID();

  if (input.status === "failed") {
    return prisma.visualGeneration.create({
      data: {
        aspect: input.aspect,
        errorMessage: input.errorMessage,
        id,
        prompt: input.prompt,
        status: "failed",
        tier: input.tier,
        tool: input.tool,
        userId: input.userId,
      },
      select: { id: true },
    });
  }

  const ext = input.mime.includes("png") ? "png" : input.mime.includes("mp4") ? "mp4" : "bin";
  const key = visualGenerationKey(input.userId, id, `output.${ext}`);
  await putObject(key, input.bytes, input.mime);

  return prisma.visualGeneration.create({
    data: {
      aspect: input.aspect,
      durationSeconds: input.durationSeconds,
      id,
      outputKey: key,
      outputMime: input.mime,
      prompt: input.prompt,
      status: "succeeded",
      tier: input.tier,
      tool: input.tool,
      userId: input.userId,
    },
    select: { id: true },
  });
}
