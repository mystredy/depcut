// Cross-account content queries for the admin Content section (Projects,
// Images, Videos). Deliberately kept out of lib/flows/db.ts and any
// project-reading module, both of which scope every read to one userId —
// these are the one place that's meant to cross accounts, and only ever
// called from a super-user-gated admin route.
import { summarize } from "@/cut/server/cloud/projects";
import { flowMediaUrl } from "@/lib/flows/media";
import { prisma } from "@/lib/prisma";
import { mediaObjectUrl } from "@/cut/server/cloud/mediaCdn";
import { projectMediaKey } from "@/cut/server/cloud/r2";

const ADMIN_PAGE_SIZE = 50;

export type AdminCutProject = {
  id: string;
  userId: string;
  name: string;
  previewUrl: string | null;
  previewIsImage: boolean;
  previewStart: number;
  /** Whether this project has ever been exported at least once — a project's
   * previewKey is only ever written by the export job (see exportJob.ts) and
   * nothing clears it afterward, so its presence is a true, durable "has this
   * been exported" signal, not just "does it currently have a proxy." */
  hasExported: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminProjectFilters = {
  /** Matched against the project's own name, case-insensitive. */
  q?: string;
  /** Matched against the owner's name, display name, or email — resolved to
   * a set of userIds first (Prisma can't join CutProject to User directly;
   * see the file header on why the tables stay FK-less), so an owner query
   * that matches nobody short-circuits to an empty result rather than
   * silently ignoring the filter. */
  ownerQuery?: string;
  exported?: "yes" | "no";
  /** updatedAt lower/upper bound, inclusive. */
  from?: Date;
  to?: Date;
};

/** Every video editor project across every account, most recently updated
 * first — the admin Content → Projects list. Reuses summarize() (the same
 * function the Projects Home page's own list uses) rather than only
 * resolving the exported previewKey: most projects never get exported, so
 * that key alone would leave nearly every card blank. summarize() falls
 * back to the doc's own first clip/asset — a live source file, the same
 * thing the Marquee grid already plays as its preview. */
export async function listCutProjectsForAdmin(filters: AdminProjectFilters = {}): Promise<AdminCutProject[]> {
  let ownerIds: string[] | undefined;
  if (filters.ownerQuery?.trim()) {
    const q = filters.ownerQuery.trim();
    const owners = await prisma.user.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
      select: { id: true },
    });
    ownerIds = owners.map((o) => o.id);
    if (ownerIds.length === 0) return [];
  }

  const rows = await prisma.cutProject.findMany({
    where: {
      ...(filters.q?.trim() ? { name: { contains: filters.q.trim(), mode: "insensitive" } } : {}),
      ...(ownerIds ? { userId: { in: ownerIds } } : {}),
      ...(filters.exported === "yes" ? { previewKey: { not: null } } : {}),
      ...(filters.exported === "no" ? { previewKey: null } : {}),
      ...(filters.from || filters.to
        ? { updatedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      userId: true,
      name: true,
      doc: true,
      folderId: true,
      favorite: true,
      version: true,
      previewKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => {
    const summary = summarize(r, 0);
    // A project's previewKey (the export-rendered proxy) and a raw source
    // asset both live under cut/-rooted keys, served through the media
    // Worker's own signed-token scheme (same as servePreview/sharedView.ts)
    // — a plain R2 presigned GET (right for Flow's flows/-rooted media,
    // wrong here) would 403 or 404 against this bucket path.
    const previewUrl = summary.hasPreview
      ? mediaObjectUrl(r.previewKey!, { version: String(r.updatedAt.getTime()) })
      : summary.previewFile
        ? mediaObjectUrl(projectMediaKey(r.userId, r.id, summary.previewFile))
        : null;
    return {
      id: r.id,
      userId: r.userId,
      name: r.name,
      previewUrl,
      // The exported proxy always starts at the edit's first frame; a raw
      // source asset starts at the clip's own trim-in (see ProjectsHome.tsx).
      previewIsImage: !summary.hasPreview && Boolean(summary.previewIsImage),
      previewStart: summary.hasPreview ? 0 : (summary.previewStart ?? 0),
      hasExported: Boolean(summary.hasPreview),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
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
