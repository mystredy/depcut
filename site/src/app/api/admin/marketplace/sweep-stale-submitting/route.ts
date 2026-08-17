import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_GRACE_MINUTES = 15;

// If the creator closes the tab right after clicking Submit, nothing is
// left running to ever report an asset's upload finished or failed — the
// XHR driving it died with the tab. A submission can end up stuck at
// "submitting" forever with no further event to promote or fail it. This
// finds anything past a grace window and fails it (plus whatever assets on
// it are still pending/uploading), so the creator gets a clear "this didn't
// make it, retry" instead of silence. A real multipart/chunked upload with
// resume would make this unnecessary; direct single-PUT uploads need it.
async function findStaleSubmissionIds(graceMinutes: number): Promise<string[]> {
  const before = new Date(Date.now() - graceMinutes * 60 * 1000);
  const stale = await prisma.submission.findMany({
    select: { id: true },
    where: { status: "submitting", updatedAt: { lt: before } },
  });
  return stale.map((s) => s.id);
}

async function failStale(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.$transaction([
    prisma.submissionAsset.updateMany({
      data: { error: "Upload stalled — the browser tab was likely closed mid-upload.", status: "failed" },
      where: { status: { in: ["pending", "uploading"] }, submissionId: { in: ids } },
    }),
    prisma.submission.updateMany({
      data: { status: "failed" },
      where: { id: { in: ids }, status: "submitting" },
    }),
  ]);
}

// Super-user only, and not on any schedule yet — this repo has no cron
// infrastructure, so run it by hand from the admin panel or wire it to an
// external scheduler later. GET previews what a sweep would fail.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const graceMinutes =
    Number(new URL(request.url).searchParams.get("graceMinutes")) || DEFAULT_GRACE_MINUTES;
  const ids = await findStaleSubmissionIds(graceMinutes);
  return NextResponse.json({ count: ids.length, graceMinutes, submissionIds: ids });
});

const sweepSchema = z.object({ graceMinutes: z.number().positive().max(24 * 60).optional() }).strict();

// Actually fails whatever GET would have previewed.
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

  const graceMinutes = parsed.data.graceMinutes ?? DEFAULT_GRACE_MINUTES;
  const ids = await findStaleSubmissionIds(graceMinutes);
  await failStale(ids);
  return NextResponse.json({ failed: ids.length, graceMinutes });
});
