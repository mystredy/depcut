import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { del, listOlderThan, MARKETPLACE_PREFIX } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_MIN_AGE_HOURS = 24;

// Submit Project uploads start the moment a file is picked, before any
// Submission row exists (see /api/submissions/drafts/[draftId]/*/presign),
// and the key an upload lands at is also its permanent home once a
// submission attaches it — nothing ever moves. A draft abandoned mid-form
// (or lost to a refresh) leaves its bytes in R2 with no row ever pointing
// at them. This walks every object under the marketplace/ prefix older than
// the cutoff and keeps only the ones no Submission.thumbnailKey/videoKey or
// Upload.mediaKey references.
async function findOrphanedDraftKeys(minAgeHours: number): Promise<string[]> {
  const before = new Date(Date.now() - minAgeHours * 60 * 60 * 1000);
  const candidates = await listOlderThan(MARKETPLACE_PREFIX, before);

  const [submissions, uploads] = await Promise.all([
    prisma.submission.findMany({
      select: { thumbnailKey: true, videoKey: true },
      where: { OR: [{ thumbnailKey: { not: null } }, { videoKey: { not: null } }] },
    }),
    prisma.upload.findMany({
      select: { mediaKey: true },
      where: { mediaKey: { not: null } },
    }),
  ]);

  const referenced = new Set<string>();
  for (const s of submissions) {
    if (s.thumbnailKey) referenced.add(s.thumbnailKey);
    if (s.videoKey) referenced.add(s.videoKey);
  }
  for (const u of uploads) {
    if (u.mediaKey) referenced.add(u.mediaKey);
  }

  return candidates.filter((key) => key.includes("/drafts/") && !referenced.has(key));
}

// Super-user only, and not on any schedule yet — this repo has no cron
// infrastructure, so run it by hand from the admin panel or wire it to an
// external scheduler later. GET previews what a sweep would remove.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const minAgeHours =
    Number(new URL(request.url).searchParams.get("minAgeHours")) || DEFAULT_MIN_AGE_HOURS;
  const orphanedKeys = await findOrphanedDraftKeys(minAgeHours);
  return NextResponse.json({ count: orphanedKeys.length, minAgeHours, orphanedKeys });
});

const sweepSchema = z.object({ minAgeHours: z.number().positive().max(24 * 365).optional() }).strict();

// Actually deletes whatever GET would have previewed.
export const POST = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = sweepSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const minAgeHours = parsed.data.minAgeHours ?? DEFAULT_MIN_AGE_HOURS;
  const orphanedKeys = await findOrphanedDraftKeys(minAgeHours);
  await del(orphanedKeys);
  return NextResponse.json({ deleted: orphanedKeys.length, minAgeHours });
});
