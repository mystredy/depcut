// Cloudflare R2 access for Cut web mode. Media bytes live here; metadata rows
// (CutMediaObject) record the keys. Only credentials come from env — bucket
// name, key scheme, and expiries are code.
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_BUCKET = "deepw-media";

const PUT_EXPIRY_SECONDS = 60 * 60; // 1h — the client uploads right after presigning
const GET_EXPIRY_SECONDS = 60 * 60; // 1h — long enough for a page view, short-lived by design

export class R2NotConfiguredError extends Error {
  constructor() {
    super("cloud storage is not configured");
  }
}

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) throw new R2NotConfiguredError();
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

// --- Key scheme: everything a user owns lives under cut/<userId>/. ---

export const projectMediaKey = (userId: string, projectId: string, fileName: string) =>
  `cut/${userId}/projects/${projectId}/media/${fileName}`;
export const projectExportKey = (userId: string, projectId: string, fileName: string) =>
  `cut/${userId}/projects/${projectId}/exports/${fileName}`;
export const projectPreviewKey = (userId: string, projectId: string) =>
  `cut/${userId}/projects/${projectId}/preview.mp4`;
/** Root of one HLS ladder. The doc version is a path segment rather than a
 * query parameter because a player reaches segments by relative URI: a version
 * that lived in the query would be dropped on the first hop out of a playlist,
 * and a re-rendered ladder would then be served the previous cut's segments out
 * of the edge cache. A new version is a new tree, and the old one is swept. */
export const projectHlsPrefix = (userId: string, projectId: string, version: string) =>
  `cut/${userId}/projects/${projectId}/hls/${version}`;
export const projectHlsRoot = (userId: string, projectId: string) =>
  `cut/${userId}/projects/${projectId}/hls/`;
/** The link-preview card's artifacts. Fixed keys, rewritten by each card
 * render: the public URL carries the doc version, so freshness rides the URL
 * and R2 keeps one copy instead of one per edit. */
export const projectCardKey = (userId: string, projectId: string, ext: "jpg" | "gif") =>
  `cut/${userId}/projects/${projectId}/card.${ext}`;
export const libraryKey = (userId: string, fileName: string) =>
  `cut/${userId}/library/${fileName}`;
export const overlayKey = (userId: string, batchId: string, name: string) =>
  `cut/${userId}/overlays/${batchId}/${name}`;

/** Scratch media a hosted inference call carries — reference sheets, keyframes,
 * chat attachments. Keyed by the SHA-256 of the bytes, so a sheet that rides
 * into thirty calls uploads once and every caller addresses it by content.
 * These live outside the per-user media prefix: they are not the user's media,
 * they never count against a storage quota, and the sweep finds them by prefix
 * rather than by row. */
export const INFERENCE_PREFIX = "cut/inference/";
export const inferenceBlobKey = (userId: string, sha256: string, ext: string) =>
  `${INFERENCE_PREFIX}${userId}/${sha256}.${ext}`;

/** The creator marketplace's Submit Project uploads — outside the Cut engine's
 * own project media, so its own top-level prefix. Uploads start the moment a
 * file is picked, before the Submission row exists, so they're keyed by a
 * client-generated draftId rather than a submissionId. The key a draft
 * upload lands at is also its permanent home once the submission is
 * created — Submission.thumbnailKey/videoKey and Upload.mediaKey just point
 * at it directly, nothing gets copied. A draft that's never submitted is an
 * orphan; sweepOrphanDrafts (below) is what reclaims it. */
export const MARKETPLACE_PREFIX = "marketplace/";
export const draftThumbnailKey = (userId: string, draftId: string) =>
  `${MARKETPLACE_PREFIX}${userId}/drafts/${draftId}/thumbnail.webp`;
export const draftVideoKey = (userId: string, draftId: string, fileName: string) =>
  `${MARKETPLACE_PREFIX}${userId}/drafts/${draftId}/video/${fileName}`;
export const draftVerificationKey = (userId: string, draftId: string, fileName: string) =>
  `${MARKETPLACE_PREFIX}${userId}/drafts/${draftId}/verification/${fileName}`;

export function presignPut(key: string, mime: string): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: mime }),
    { expiresIn: PUT_EXPIRY_SECONDS }
  );
}

/** A time-limited GET URL — used for private objects an `<img>`/`<video>` can
 * be pointed at directly via a redirect, without proxying bytes through us. */
export function presignGet(key: string): Promise<string> {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), {
    expiresIn: GET_EXPIRY_SECONDS,
  });
}


/** Object size/type, or null when the object does not exist. */
export async function head(
  key: string
): Promise<{ bytes: number; mime: string; etag: string } | null> {
  try {
    const res = await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return {
      bytes: Number(res.ContentLength ?? 0),
      mime: res.ContentType ?? "",
      // Quoted on the wire, and the quotes would need escaping in a URL.
      etag: (res.ETag ?? "").replace(/[^\w]/g, ""),
    };
  } catch (e) {
    if (e instanceof R2NotConfiguredError) throw e;
    return null;
  }
}

/** An object's bytes, or null when it does not exist. */
export async function getObject(key: string): Promise<{ bytes: Buffer; mime: string } | null> {
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    const body = res.Body;
    if (!body) return null;
    return {
      bytes: Buffer.from(await body.transformToByteArray()),
      mime: res.ContentType ?? "application/octet-stream",
    };
  } catch (e) {
    if (e instanceof R2NotConfiguredError) throw e;
    return null;
  }
}

/**
 * Delete everything under `prefix`, paging until the listing is empty.
 *
 * Deleting a tree cannot be "list once, then delete": an HLS ladder for a long
 * cut runs to tens of thousands of objects, and a single capped listing would
 * leave the remainder behind with nothing left pointing at it. Returns how many
 * objects went.
 */
export async function deletePrefix(prefix: string): Promise<number> {
  let removed = 0;
  // Bounded so a listing that somehow never drains cannot spin forever; each
  // pass removes up to 1000, so this is far above any real ladder.
  for (let pass = 0; pass < 1000; pass++) {
    const keys = await listUnder(prefix, 1000);
    if (keys.length === 0) return removed;
    await del(keys);
    removed += keys.length;
    // A delete that silently removed nothing would otherwise loop on the same
    // page: del swallows its own failures, so treat no progress as done.
    if (keys.length < 1000) return removed;
  }
  return removed;
}

/** Every key under `prefix`, up to `limit`. Callers deleting a whole tree
 * should use deletePrefix, which pages instead of truncating. */
export async function listUnder(prefix: string, limit = 10_000): Promise<string[]> {
  const out: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2().send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const o of res.Contents ?? []) {
      if (o.Key) out.push(o.Key);
      if (out.length >= limit) return out;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/** Keys under `prefix` last written before `before`, paged to `limit` objects.
 * For prefix sweeps of objects no database row tracks. */
export async function listOlderThan(
  prefix: string,
  before: Date,
  limit = 5000
): Promise<string[]> {
  const out: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2().send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const o of res.Contents ?? []) {
      if (o.Key && o.LastModified && o.LastModified < before) out.push(o.Key);
      if (out.length >= limit) return out;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export async function copy(srcKey: string, dstKey: string): Promise<void> {
  await r2().send(
    new CopyObjectCommand({
      Bucket: R2_BUCKET,
      CopySource: `${R2_BUCKET}/${encodeURIComponent(srcKey).replace(/%2F/g, "/")}`,
      Key: dstKey,
    })
  );
}

export async function putObject(key: string, body: Buffer, mime: string): Promise<void> {
  await r2().send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: mime })
  );
}

/** Best-effort bulk delete — object cleanup never fails a row delete. */
export async function del(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const s3 = r2();
    for (let i = 0; i < keys.length; i += 1000) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        })
      );
    }
  } catch {
    // Orphaned objects are collectible later by key prefix; the rows are gone.
  }
}
