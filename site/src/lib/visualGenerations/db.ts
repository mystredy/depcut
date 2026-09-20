import { visualGenerationKey } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";
import { delStrict, presignGet, putObject } from "@/cut/server/cloud/r2";

type CreateVisualBase = {
  userId: string;
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

/** Record a finished (succeeded or failed) Text to Video run — called once
 * per take, right after it settles client-side (see
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
        userId: input.userId,
      },
      select: { id: true },
    });
  }

  const key = visualGenerationKey(input.userId, id, "output.mp4");
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
      userId: input.userId,
    },
    select: { id: true },
  });
}

export type VisualGenerationRow = {
  id: string;
  prompt: string;
  aspect: string;
  status: string;
  errorMessage: string | null;
  outputUrl: string | null;
  outputMime: string | null;
  durationSeconds: number | null;
  createdAt: Date;
};

const HISTORY_LIMIT = 50;

/** The signed-in user's own Text to Video history. */
export async function listVisualGenerations(userId: string): Promise<VisualGenerationRow[]> {
  const rows = await prisma.visualGeneration.findMany({
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    where: { userId },
  });
  return Promise.all(
    rows.map(async (r) => ({
      aspect: r.aspect,
      createdAt: r.createdAt,
      durationSeconds: r.durationSeconds,
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

/** Same order as deleteImageGeneration: a failed row has no media, a
 * succeeded row's storage object goes first. */
export async function deleteVisualGeneration(userId: string, id: string): Promise<DeleteGenerationResult> {
  const row = await prisma.visualGeneration.findFirst({ select: { outputKey: true }, where: { id, userId } });
  if (!row) return "not_found";
  if (row.outputKey) {
    const { failed } = await delStrict([row.outputKey]);
    if (failed.length > 0) return "storage_error";
  }
  await prisma.visualGeneration.delete({ where: { id } });
  return "deleted";
}
