import { prisma } from "@/lib/prisma";

export { prisma };

/** The columns a claimed CutRenderJob row hands the job runners. */
export interface ClaimedJob {
  id: string;
  userId: string;
  projectId: string | null;
  kind: string;
  spec: unknown;
  outName: string | null;
}

/**
 * Record a finished R2 object and keep the user's storage total in step. The
 * upsert makes re-registering the same key (a preview re-render, a retried
 * job) charge only the size delta instead of double-counting.
 */
export async function registerObject(opts: {
  userId: string;
  projectId: string;
  r2Key: string;
  fileName: string;
  mime: string;
  bytes: number;
  kind: string;
}): Promise<void> {
  const prior = await prisma.cutMediaObject.findUnique({
    where: { r2Key: opts.r2Key },
    select: { bytes: true, uploadState: true },
  });
  const priorBytes = prior?.uploadState === "complete" ? prior.bytes : BigInt(0);
  const delta = BigInt(opts.bytes) - priorBytes;
  await prisma.$transaction([
    prisma.cutMediaObject.upsert({
      where: { r2Key: opts.r2Key },
      create: {
        userId: opts.userId,
        projectId: opts.projectId,
        r2Key: opts.r2Key,
        fileName: opts.fileName,
        mime: opts.mime,
        bytes: BigInt(opts.bytes),
        kind: opts.kind,
        uploadState: "complete",
      },
      update: { bytes: BigInt(opts.bytes), uploadState: "complete" },
    }),
    prisma.cutStorageUsage.upsert({
      where: { userId: opts.userId },
      create: { userId: opts.userId, bytes: delta },
      update: { bytes: { increment: delta } },
    }),
  ]);
}

/**
 * Undo registerObject for a job's staged files: drop the rows and hand the
 * bytes back to the user's storage total. R2 object deletion is the caller's
 * (best-effort) follow-up.
 */
export async function unregisterObjects(userId: string, r2Keys: string[]): Promise<void> {
  if (r2Keys.length === 0) return;
  const rows = await prisma.cutMediaObject.findMany({
    where: { userId, r2Key: { in: r2Keys } },
    select: { id: true, bytes: true, uploadState: true },
  });
  if (rows.length === 0) return;
  const bytes = rows.reduce(
    (sum, r) => (r.uploadState === "complete" ? sum + Number(r.bytes) : sum),
    0
  );
  await prisma.$transaction(async (tx) => {
    await tx.cutMediaObject.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    const usage = await tx.cutStorageUsage.findUnique({ where: { userId } });
    const next = Math.max(0, (usage ? Number(usage.bytes) : 0) - bytes);
    await tx.cutStorageUsage.upsert({
      where: { userId },
      create: { userId, bytes: BigInt(next) },
      update: { bytes: BigInt(next) },
    });
  });
}

/** Land one downloaded file in the shared Library instead of a project: the
 * media object plus its CutLibraryAsset metadata row, in one step since the
 * worker already has the bytes (unlike the browser's presign-then-complete
 * upload, which needs the pending row in between). */
export async function registerLibraryObject(opts: {
  userId: string;
  r2Key: string;
  fileName: string;
  mime: string;
  bytes: number;
  meta: { name: string; type: "video" | "audio" | "image"; duration: number };
}): Promise<{ id: string; fileName: string; name: string; type: string; duration: number; addedAt: number }> {
  const prior = await prisma.cutMediaObject.findUnique({
    where: { r2Key: opts.r2Key },
    select: { bytes: true, uploadState: true },
  });
  const priorBytes = prior?.uploadState === "complete" ? prior.bytes : BigInt(0);
  const delta = BigInt(opts.bytes) - priorBytes;
  const asset = await prisma.$transaction(async (tx) => {
    const obj = await tx.cutMediaObject.upsert({
      where: { r2Key: opts.r2Key },
      create: {
        userId: opts.userId,
        r2Key: opts.r2Key,
        fileName: opts.fileName,
        mime: opts.mime,
        bytes: BigInt(opts.bytes),
        kind: "library",
        uploadState: "complete",
      },
      update: { bytes: BigInt(opts.bytes), uploadState: "complete" },
    });
    await tx.cutStorageUsage.upsert({
      where: { userId: opts.userId },
      create: { userId: opts.userId, bytes: delta },
      update: { bytes: { increment: delta } },
    });
    return tx.cutLibraryAsset.create({
      data: { userId: opts.userId, mediaObjectId: obj.id, meta: opts.meta },
    });
  });
  return {
    id: asset.id,
    fileName: opts.fileName,
    name: opts.meta.name,
    type: opts.meta.type,
    duration: opts.meta.duration,
    addedAt: asset.createdAt.getTime(),
  };
}

/** Undo registerLibraryObject for a job's staged files: the CutLibraryAsset
 * rows have no DB-level foreign key to their media objects (this schema
 * never declares that relation — see CutLibraryAsset.mediaObjectId), so
 * unregisterObjects alone would leave them dangling. Delete them first,
 * then fall through to the same row/usage cleanup every other job kind
 * uses. R2 object deletion stays the caller's (best-effort) follow-up. */
export async function unregisterLibraryObjects(userId: string, r2Keys: string[]): Promise<void> {
  if (r2Keys.length === 0) return;
  const objects = await prisma.cutMediaObject.findMany({
    where: { userId, r2Key: { in: r2Keys } },
    select: { id: true },
  });
  if (objects.length > 0) {
    await prisma.cutLibraryAsset.deleteMany({
      where: { userId, mediaObjectId: { in: objects.map((o) => o.id) } },
    });
  }
  await unregisterObjects(userId, r2Keys);
}
