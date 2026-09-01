// Query helpers for the Flow gallery/thread — thin wrappers around Prisma so
// the API routes stay short. See prisma/GenerationFlows.prisma for the
// tables; every read here is scoped to a userId, checked at the call site.
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { flowMediaUrl } from "@/lib/flows/media";
import { copy as copyR2Object, flowMediaKey } from "@/cut/server/cloud/r2";

export type FlowSummary = {
  id: string;
  name: string;
  coverUrl: string | null;
  hasImage: boolean;
  hasVideo: boolean;
  hasFavorite: boolean;
  processing: boolean;
  updatedAt: Date;
};

export type FlowListFilters = {
  /** Matches against the Flow's own name OR any of its generations' prompt
   * text — a Flow with no matching name can still turn up by what's in it. */
  q?: string;
  kind?: "image" | "video";
  favoritesOnly?: boolean;
};

/** The gallery list — most recently updated first, filtered server-side so
 * the response is already the matching set rather than a client trimming an
 * unbounded list. One query for the cover candidate (auto or pinned) plus a
 * cheap aggregate for what kinds/status/favorites each flow holds, rather
 * than pulling every generation row per flow. */
export async function listFlows(userId: string, filters?: FlowListFilters): Promise<FlowSummary[]> {
  const conditions: Prisma.GenerationFlowWhereInput[] = [];
  const q = filters?.q?.trim();
  if (q) {
    conditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { generations: { some: { prompt: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (filters?.kind) conditions.push({ generations: { some: { kind: filters.kind } } });
  if (filters?.favoritesOnly) conditions.push({ generations: { some: { favorite: true } } });

  const flows = await prisma.generationFlow.findMany({
    where: conditions.length > 0 ? { userId, AND: conditions } : { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (flows.length === 0) return [];

  const flowIds = flows.map((f) => f.id);
  const generations = await prisma.flowGeneration.findMany({
    where: { flowId: { in: flowIds } },
    orderBy: { createdAt: "asc" },
    select: { flowId: true, kind: true, status: true, outputKey: true, posterKey: true, favorite: true },
  });
  const byFlow = new Map<string, typeof generations>();
  for (const g of generations) {
    const list = byFlow.get(g.flowId) ?? [];
    list.push(g);
    byFlow.set(g.flowId, list);
  }

  return Promise.all(
    flows.map(async (f) => {
      const rows = byFlow.get(f.id) ?? [];
      // A video's own bytes can't render as a cover <img> — only its poster
      // frame can. An image row's output is a picture already.
      const auto = rows
        .filter((r) => r.status === "completed")
        .map((r) => (r.kind === "video" ? r.posterKey : r.outputKey))
        .find((k): k is string => !!k);
      const coverKey = f.coverKey ?? auto ?? null;
      return {
        id: f.id,
        name: f.name,
        coverUrl: coverKey ? await flowMediaUrl(coverKey) : null,
        hasImage: rows.some((r) => r.kind === "image"),
        hasVideo: rows.some((r) => r.kind === "video"),
        hasFavorite: rows.some((r) => r.favorite),
        processing: rows.some((r) => r.status === "in_progress"),
        updatedAt: f.updatedAt,
      };
    })
  );
}

export async function ownedFlow(userId: string, flowId: string) {
  return prisma.generationFlow.findFirst({ where: { id: flowId, userId } });
}

export async function createFlow(userId: string, name: string) {
  return prisma.generationFlow.create({ data: { userId, name } });
}

export async function renameFlow(flowId: string, name: string) {
  return prisma.generationFlow.update({ where: { id: flowId }, data: { name } });
}

/** Pin an explicit cover — flips coverIsAuto off so a later generation never
 * silently replaces the user's pick (see GenerationFlow.coverIsAuto). */
export async function setFlowCover(flowId: string, coverKey: string) {
  return prisma.generationFlow.update({ where: { id: flowId }, data: { coverKey, coverIsAuto: false } });
}

/** Called after a generation lands successfully — advances the auto cover to
 * the flow's first completed output, once, the same way a chat thread's
 * title locks to its first message. A no-op once coverIsAuto is false or a
 * cover is already set. */
export async function maybeSetAutoCover(flowId: string, outputKey: string) {
  await prisma.generationFlow.updateMany({
    where: { id: flowId, coverIsAuto: true, coverKey: null },
    data: { coverKey: outputKey },
  });
}

export async function deleteFlow(flowId: string) {
  // FlowGeneration rows cascade (onDelete: Cascade); R2 objects are swept
  // best-effort by the caller before this, since del() never throws.
  await prisma.generationFlow.delete({ where: { id: flowId } });
}

/** Every R2 object one generation row owns: its output, poster frame, and
 * any persisted reference images — the exact set a delete must remove for
 * that row to leave nothing orphaned behind. */
export function generationMediaKeys(row: {
  outputKey: string | null;
  posterKey: string | null;
  referenceKeys: unknown;
}): string[] {
  const refs = Array.isArray(row.referenceKeys)
    ? row.referenceKeys.filter((k): k is string => typeof k === "string")
    : [];
  return [row.outputKey, row.posterKey, ...refs].filter((k): k is string => !!k);
}

export async function flowGenerationKeys(flowId: string): Promise<string[]> {
  const rows = await prisma.flowGeneration.findMany({
    where: { flowId },
    select: { outputKey: true, posterKey: true, referenceKeys: true },
  });
  return rows.flatMap(generationMediaKeys);
}

export type FlowGenerationView = {
  id: string;
  kind: string;
  prompt: string;
  name: string | null;
  favorite: boolean;
  provider: string;
  model: string;
  parameters: unknown;
  refMode: string | null;
  parentGenerationId: string | null;
  status: string;
  errorMessage: string | null;
  outputUrl: string | null;
  outputMime: string | null;
  posterUrl: string | null;
  referenceUrls: string[];
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt: Date;
};

export async function listFlowGenerations(flowId: string): Promise<FlowGenerationView[]> {
  const rows = await prisma.flowGeneration.findMany({
    where: { flowId },
    orderBy: { createdAt: "asc" },
  });
  return Promise.all(
    rows.map(async (r) => {
      const refKeys = Array.isArray(r.referenceKeys)
        ? r.referenceKeys.filter((k): k is string => typeof k === "string")
        : [];
      return {
        id: r.id,
        kind: r.kind,
        prompt: r.prompt,
        name: r.name,
        favorite: r.favorite,
        provider: r.provider,
        model: r.model,
        parameters: r.parameters,
        refMode: r.refMode,
        parentGenerationId: r.parentGenerationId,
        status: r.status,
        errorMessage: r.errorMessage,
        outputUrl: r.outputKey ? await flowMediaUrl(r.outputKey) : null,
        outputMime: r.outputMime,
        posterUrl: r.posterKey ? await flowMediaUrl(r.posterKey) : null,
        referenceUrls: await Promise.all(refKeys.map((k) => flowMediaUrl(k))),
        width: r.width,
        height: r.height,
        durationSeconds: r.durationSeconds,
        createdAt: r.createdAt,
      };
    })
  );
}

const keyExt = (key: string): string => key.split(".").pop() || "bin";

/** Duplicate a flow's rows onto a new flow id. Every media object a row
 * owns — its output, poster frame, and any persisted reference images — is
 * copied to a FRESH key under the new flow's own R2 prefix, never left
 * pointing at the source's keys. R2 objects are immutable once written, so
 * this is a server-side copy (no bytes pass through this process), not a
 * re-upload — but it still has to happen: two flows sharing an object key
 * would mean deleting either one's media could take out the other's, and a
 * Flow's delete route trusts that its own keys are its own to remove. */
export async function duplicateFlow(
  userId: string,
  source: { id: string; name: string; coverKey: string | null; coverIsAuto: boolean }
) {
  const rows = await prisma.flowGeneration.findMany({ where: { flowId: source.id }, orderBy: { createdAt: "asc" } });
  const newFlowId = crypto.randomUUID();

  // Same source key copied twice (unlikely today, but referenceKeys could
  // one day point at a shared upload) lands on the same new key instead of
  // being copied — and billed in R2 operations — twice.
  const copied = new Map<string, string>();
  const copyKey = async (oldKey: string, genId: string, suffix: string): Promise<string> => {
    const cached = copied.get(oldKey);
    if (cached) return cached;
    const newKey = flowMediaKey(userId, newFlowId, `${genId}${suffix}.${keyExt(oldKey)}`);
    await copyR2Object(oldKey, newKey);
    copied.set(oldKey, newKey);
    return newKey;
  };

  const newRows = await Promise.all(
    rows.map(async (r) => {
      const genId = crypto.randomUUID();
      const outputKey = r.outputKey ? await copyKey(r.outputKey, genId, "") : null;
      const posterKey = r.posterKey ? await copyKey(r.posterKey, genId, "-poster") : null;
      const sourceRefKeys = Array.isArray(r.referenceKeys)
        ? (r.referenceKeys as unknown[]).filter((k): k is string => typeof k === "string")
        : [];
      const referenceKeys = await Promise.all(sourceRefKeys.map((k, i) => copyKey(k, genId, `-ref${i}`)));
      return { row: r, genId, outputKey, posterKey, referenceKeys };
    })
  );

  // The flow's own cover points at whichever generation's output it was
  // pinned (or auto-set) to — follow it through the same key map so the
  // duplicate's cover shows its own copy, not reach across into the
  // source's.
  const coverKey = source.coverKey ? (copied.get(source.coverKey) ?? null) : null;

  return prisma.$transaction(async (tx) => {
    const flow = await tx.generationFlow.create({
      data: { id: newFlowId, userId, name: `${source.name} copy`, coverKey, coverIsAuto: source.coverIsAuto },
    });
    if (newRows.length > 0) {
      await tx.flowGeneration.createMany({
        data: newRows.map(({ row: r, genId, outputKey, posterKey, referenceKeys }) => ({
          id: genId,
          flowId: newFlowId,
          userId,
          kind: r.kind,
          prompt: r.prompt,
          provider: r.provider,
          model: r.model,
          name: r.name,
          favorite: r.favorite,
          // Not carried: idempotencyKey (would collide on its unique index —
          // a copy was never itself submitted) and parentGenerationId (the
          // parent lives in the source flow; a duplicate starts its own
          // lineage rather than pointing across flows).
          parameters: r.parameters as never,
          refMode: r.refMode,
          referenceKeys: referenceKeys as never,
          status: r.status,
          errorMessage: r.errorMessage,
          outputKey,
          outputMime: r.outputMime,
          posterKey,
          width: r.width,
          height: r.height,
          durationSeconds: r.durationSeconds,
        })),
      });
    }
    return flow;
  });
}
