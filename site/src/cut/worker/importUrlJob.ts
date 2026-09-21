import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { typeOf } from "../server/cloud/util";
import { download } from "../server/urlDownload";
import {
  prisma,
  registerLibraryObject,
  registerObject,
  unregisterLibraryObjects,
  unregisterObjects,
  type ClaimedJob,
} from "./db";
import { deleteObjects, libraryKey, mediaKey, mimeFor, uploadFile } from "./r2";

/** What a project-scoped import_url job records in CutRenderJob.result — the
 * same shape the engine's synchronous import route returns to the client. */
export interface ImportUrlResult {
  files: { fileName: string; title: string }[];
  text?: string;
}

/** What a library-scoped import_url job (job.projectId null) records —
 * ready-to-render LibraryAsset views, unlike the project variant's bare
 * file names (a library asset has no project doc to carry its metadata,
 * so the row itself has to be client-ready). */
export interface ImportUrlLibraryResult {
  assets: {
    id: string;
    fileName: string;
    name: string;
    type: string;
    duration: number;
    addedAt: number;
  }[];
}

/** First variant of `base` (stem, stem-1, stem-2, …) not already `taken` —
 * the engine's on-disk dedupe scheme, run against the project's media rows. */
function dedupeName(base: string, taken: Set<string>): string {
  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length) || "media";
  let name = base;
  for (let n = 1; taken.has(name); n++) name = `${stem}-${n}${ext}`;
  return name;
}

/**
 * Run one import_url job: fetch the URL into a temp dir with the shared
 * yt-dlp/tweet-photo logic, then land each file either in the project's R2
 * media prefix (job.projectId set — the chat's import_url tool and the
 * project media panel) or in the shared Library (projectId null — the
 * Library panel's "paste a link" box), each deduped against its own
 * existing names.
 */
export async function runImportUrlJob(
  job: ClaimedJob,
  isCanceled: () => boolean
): Promise<ImportUrlResult | ImportUrlLibraryResult> {
  const { url } = (job.spec ?? {}) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url.trim())) throw new Error("Enter a valid http(s) URL.");

  const tmp = await mkdtemp(path.join(os.tmpdir(), "cut-dl-"));
  try {
    const dl = await download(url.trim(), tmp);
    if (isCanceled()) throw new Error("Import canceled.");
    return job.projectId
      ? await landInProject(job.userId, job.projectId, dl, isCanceled)
      : await landInLibrary(job.userId, dl, isCanceled);
  } finally {
    void rm(tmp, { recursive: true, force: true });
  }
}

async function landInProject(
  userId: string,
  projectId: string,
  dl: Awaited<ReturnType<typeof download>>,
  isCanceled: () => boolean
): Promise<ImportUrlResult> {
  const rows = await prisma.cutMediaObject.findMany({
    where: { projectId, kind: "media" },
    select: { fileName: true },
  });
  const taken = new Set(rows.map((r) => r.fileName));
  const files: ImportUrlResult["files"] = [];
  // A failed or canceled run keeps no bytes: whatever it staged in R2 is
  // unregistered and deleted before the error propagates, so the project's
  // storage only ever holds media the client can still adopt.
  const staged: string[] = [];
  try {
    for (const f of dl.files) {
      if (isCanceled()) throw new Error("Import canceled.");
      const fileName = dedupeName(path.basename(f.file), taken);
      taken.add(fileName);
      const key = mediaKey(userId, projectId, fileName);
      staged.push(key);
      const bytes = await uploadFile(key, f.file, mimeFor(fileName));
      await registerObject({
        userId,
        projectId,
        r2Key: key,
        fileName,
        mime: mimeFor(fileName),
        bytes,
        kind: "media",
      });
      files.push({ fileName, title: f.title });
    }
    return { files, ...(dl.text ? { text: dl.text } : {}) };
  } catch (err) {
    await unregisterObjects(userId, staged).catch(() => {});
    await deleteObjects(staged);
    throw err;
  }
}

async function landInLibrary(
  userId: string,
  dl: Awaited<ReturnType<typeof download>>,
  isCanceled: () => boolean
): Promise<ImportUrlLibraryResult> {
  if (dl.files.length === 0) throw new Error("That link has no media to import.");
  const rows = await prisma.cutMediaObject.findMany({
    where: { userId, kind: "library" },
    select: { fileName: true },
  });
  const taken = new Set(rows.map((r) => r.fileName));
  const assets: ImportUrlLibraryResult["assets"] = [];
  // Same all-or-nothing cleanup as landInProject: a failed or canceled run
  // leaves no partial library entries behind.
  const staged: string[] = [];
  try {
    for (const f of dl.files) {
      if (isCanceled()) throw new Error("Import canceled.");
      const fileName = dedupeName(path.basename(f.file), taken);
      taken.add(fileName);
      const key = libraryKey(userId, fileName);
      staged.push(key);
      const bytes = await uploadFile(key, f.file, mimeFor(fileName));
      // No server-side ffprobe pass here (unlike the local engine's
      // register(), which reads real duration/dimensions off disk) — the
      // asset lands with duration 0 until something probes it, the same
      // gap a direct presigned library upload already has when its caller
      // skips the meta.duration field.
      const asset = await registerLibraryObject({
        userId,
        r2Key: key,
        fileName,
        mime: mimeFor(fileName),
        bytes,
        meta: { name: f.title || fileName, type: typeOf(fileName) ?? "video", duration: 0 },
      });
      assets.push(asset);
    }
    return { assets };
  } catch (err) {
    await unregisterLibraryObjects(userId, staged).catch(() => {});
    await deleteObjects(staged);
    throw err;
  }
}
