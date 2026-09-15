import { imageGenerationKey } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";
import { putObject } from "@/cut/server/cloud/r2";

type CreateImageBase = {
  userId: string;
  prompt: string;
  aspect: string;
  tier: string;
};

export type CreateImageInput =
  | (CreateImageBase & { status: "succeeded"; bytes: Buffer; mime: string })
  | (CreateImageBase & { status: "failed"; errorMessage: string });

/** Record a finished (succeeded or failed) Text to Image run — called once
 * per take, right after it settles client-side (see
 * cut/lib/imageGenerationPersist.ts). A succeeded row uploads its bytes to
 * R2 first; a failed row has no media to store. */
export async function createImageGeneration(input: CreateImageInput): Promise<{ id: string }> {
  const id = crypto.randomUUID();

  if (input.status === "failed") {
    return prisma.imageGeneration.create({
      data: {
        aspect: input.aspect,
        errorMessage: input.errorMessage,
        id,
        prompt: input.prompt,
        status: "failed",
        tier: input.tier,
        userId: input.userId,
      },
      select: { id: true },
    });
  }

  const key = imageGenerationKey(input.userId, id, "output.png");
  await putObject(key, input.bytes, input.mime);

  return prisma.imageGeneration.create({
    data: {
      aspect: input.aspect,
      id,
      outputKey: key,
      outputMime: input.mime,
      prompt: input.prompt,
      status: "succeeded",
      tier: input.tier,
      userId: input.userId,
    },
    select: { id: true },
  });
}
