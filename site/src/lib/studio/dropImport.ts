import { dropVideoKey, putObject } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export type ImportablePost = {
  externalId: string;
  videoUrl: string;
  caption?: string;
};

export type DropImportOutcome =
  | { ok: true; dropId: string; externalId: string }
  | { ok: false; externalId: string; error: string };

// Downloads one external post's video and creates it as a Drop — the
// inbound counterpart to dropPublish.ts's publishDropToWorkflow. Buffers
// the whole video in memory, same constraint youtube-api.ts's publish
// already lives with: fine for Reels/Shorts-length clips, not a streaming
// rewrite for long-form video.
export async function importPostAsDrop(
  post: ImportablePost,
  opts: { studioId: string; studioOwnerId: string; platform: string },
): Promise<DropImportOutcome> {
  try {
    const sourceRes = await fetch(post.videoUrl);
    if (!sourceRes.ok || !sourceRes.body) {
      throw new Error(`Couldn't fetch the video from ${opts.platform} (${sourceRes.status}).`);
    }
    const video = Buffer.from(await sourceRes.arrayBuffer());

    const drop = await prisma.drop.create({
      data: {
        caption: post.caption || null,
        fileName: `${post.externalId}.mp4`,
        importedExternalId: post.externalId,
        importedPlatform: opts.platform,
        sizeBytes: video.byteLength,
        status: "complete",
        studioId: opts.studioId,
        userId: opts.studioOwnerId,
      },
    });

    const storageKey = dropVideoKey(opts.studioOwnerId, drop.id, `${post.externalId}.mp4`);
    await putObject(storageKey, video, sourceRes.headers.get("content-type") ?? "video/mp4");
    await prisma.drop.update({ data: { storageKey }, where: { id: drop.id } });

    return { dropId: drop.id, externalId: post.externalId, ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed.";
    return { error: message, externalId: post.externalId, ok: false };
  }
}
