// Cross-account content queries for the admin Content section (Projects,
// Images, Videos). Deliberately kept out of lib/flows/db.ts and any
// project-reading module, both of which scope every read to one userId —
// these are the one place that's meant to cross accounts, and only ever
// called from a super-user-gated admin route.
import { flowMediaUrl } from "@/lib/flows/media";
import { prisma } from "@/lib/prisma";
import { presignGet } from "@/cut/server/cloud/r2";

const ADMIN_PAGE_SIZE = 50;

export type AdminCutProject = {
  id: string;
  userId: string;
  name: string;
  previewUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Every video editor project across every account, most recently updated
 * first — the admin Content → Projects list. */
export async function listCutProjectsForAdmin(): Promise<AdminCutProject[]> {
  const rows = await prisma.cutProject.findMany({
    orderBy: { updatedAt: "desc" },
    take: ADMIN_PAGE_SIZE,
    select: { id: true, userId: true, name: true, previewKey: true, createdAt: true, updatedAt: true },
  });
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      previewUrl: r.previewKey ? await presignGet(r.previewKey) : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  );
}

export type AdminFlowGeneration = {
  id: string;
  userId: string;
  flowId: string;
  kind: string;
  prompt: string;
  provider: string;
  model: string;
  outputUrl: string | null;
  posterUrl: string | null;
  createdAt: Date;
};

/** Every completed Flow image or video across every account, most recent
 * first — the admin Content → Images/Videos lists. */
export async function listFlowGenerationsForAdmin(kind: "image" | "video"): Promise<AdminFlowGeneration[]> {
  const rows = await prisma.flowGeneration.findMany({
    where: { kind, status: "completed" },
    orderBy: { createdAt: "desc" },
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      userId: true,
      flowId: true,
      kind: true,
      prompt: true,
      provider: true,
      model: true,
      outputKey: true,
      posterKey: true,
      createdAt: true,
    },
  });
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      userId: r.userId,
      flowId: r.flowId,
      kind: r.kind,
      prompt: r.prompt,
      provider: r.provider,
      model: r.model,
      outputUrl: r.outputKey ? await flowMediaUrl(r.outputKey) : null,
      posterUrl: r.posterKey ? await flowMediaUrl(r.posterKey) : null,
      createdAt: r.createdAt,
    }))
  );
}
