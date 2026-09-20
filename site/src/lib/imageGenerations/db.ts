import { imageGenerationKey } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";
import { delStrict, presignGet, putObject } from "@/cut/server/cloud/r2";

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

export type ImageGenerationRow = {
  id: string;
  prompt: string;
  aspect: string;
  status: string;
  errorMessage: string | null;
  outputUrl: string | null;
  outputMime: string | null;
  createdAt: Date;
};

const HISTORY_LIMIT = 50;

/** The signed-in user's own Text to Image history. */
export async function listImageGenerations(userId: string): Promise<ImageGenerationRow[]> {
  const rows = await prisma.imageGeneration.findMany({
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    where: { userId },
  });
  return Promise.all(
    rows.map(async (r) => ({
      aspect: r.aspect,
      createdAt: r.createdAt,
      errorMessage: r.errorMessage,
      id: r.id,
      outputMime: r.outputMime,
      outputUrl: r.outputKey ? await presignGet(r.outputKey) : null,
      prompt: r.prompt,
      status: r.status,
    })),
  );
}

export type DeleteGenerationResult = "deleted" | "not_found" | "storage_error";

/** A failed row has no media, so its row deletes outright; a succeeded row's
 * storage object goes first, same order as deleteAudioGeneration. */
export async function deleteImageGeneration(userId: string, id: string): Promise<DeleteGenerationResult> {
  const row = await prisma.imageGeneration.findFirst({ select: { outputKey: true }, where: { id, userId } });
  if (!row) return "not_found";
  if (row.outputKey) {
    const { failed } = await delStrict([row.outputKey]);
    if (failed.length > 0) return "storage_error";
  }
  await prisma.imageGeneration.delete({ where: { id } });
  return "deleted";
}
