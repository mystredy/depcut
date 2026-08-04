import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { head, MARKETPLACE_PREFIX } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Thumbnail/video/verification bytes already live in R2 by the time this
// call runs — uploads start the instant a file is picked (see
// /api/submissions/drafts/[draftId]/*/presign), keyed by a client-generated
// draftId. This call just verifies the keys landed and attaches them.
const createSubmissionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    categoryId: z.string().trim().min(1),
    subSource: z.enum(["InspiredExternal", "TaskExternal"]),
    inspireUrl: z.string().trim().max(2000).optional(),
    voiceScript: z.string().trim().min(1).max(5000),
    spaceid: z.string().trim().min(1).max(160),
    videofile: z.string().trim().max(300).optional(),
    thumbnailFile: z.string().trim().max(300).optional(),
    thumbnailKey: z.string().trim().max(500).optional(),
    videoKey: z.string().trim().max(500).optional(),
    extension: z.enum(["standard", "pro"]).default("standard"),
    editCode: z.string().trim().max(60).optional(),
    watermarkEnabled: z.boolean().default(false),
    watermarkText: z.string().trim().max(120).optional(),
    burnInCaptions: z.boolean().default(false),
    generatedMetadata: z.boolean().default(false),
    // Pro Verification Suite only: becomes the linked Upload's publishing
    // package (see prisma/Marketplace.prisma's Upload model) — its own
    // title, kept separate from the Submission's own title above.
    packageTitle: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    tags: z.string().trim().max(500).optional(),
    mediaFile: z.string().trim().max(300).optional(),
    verificationKey: z.string().trim().max(500).optional(),
  })
  .strict();

export const POST = withDonkeyAuth(async (request) => {
  const parsed = createSubmissionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const {
    packageTitle,
    description,
    tags,
    mediaFile,
    thumbnailKey,
    videoKey,
    verificationKey,
    ...submissionFields
  } = parsed.data;
  const userId = request.donkey.userId;

  // Every draft key is scoped under the caller's own userId, so a key that
  // doesn't start with this prefix belongs to someone else (or was never a
  // real draft key at all).
  const draftPrefix = `${MARKETPLACE_PREFIX}${userId}/drafts/`;
  for (const key of [thumbnailKey, videoKey, verificationKey]) {
    if (key && !key.startsWith(draftPrefix)) {
      return NextResponse.json({ error: "Invalid upload key" }, { status: 400 });
    }
  }
  if (thumbnailKey && !(await head(thumbnailKey))) {
    return NextResponse.json({ error: "The thumbnail upload never arrived." }, { status: 400 });
  }
  if (videoKey && !(await head(videoKey))) {
    return NextResponse.json({ error: "The video upload never arrived." }, { status: 400 });
  }
  if (verificationKey && !(await head(verificationKey))) {
    return NextResponse.json({ error: "The verification upload never arrived." }, { status: 400 });
  }

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.submission.create({
      data: {
        ...submissionFields,
        thumbnailKey,
        videoKey,
        // Inspire-mode submissions have no linked Task to inherit maxRates
        // from, so they default to 10.
        maxRates: 10,
        status: "submitted",
        reviewStatus: "Pending",
        userId,
      },
    });

    // Pro submissions carry a publishing package (title/description/tags) —
    // create its Upload row and point the submission at it.
    if (submissionFields.extension === "pro" && packageTitle) {
      const upload = await tx.upload.create({
        data: {
          createdById: userId,
          description,
          mediaFile,
          mediaKey: verificationKey,
          submissionId: created.id,
          tags,
          title: packageTitle,
        },
      });
      return tx.submission.update({
        data: { publishingid: upload.id },
        where: { id: created.id },
      });
    }

    return created;
  });

  const { thumbnailKey: savedThumbnailKey, videoKey: savedVideoKey, ...rest } = submission;

  return NextResponse.json({
    submission: {
      ...rest,
      hasThumbnail: Boolean(savedThumbnailKey),
      hasVideo: Boolean(savedVideoKey),
    },
  });
});

// The signed-in user's own submissions, newest first — feeds My Submissions.
export const GET = withDonkeyAuth(async (request) => {
  const rows = await prisma.submission.findMany({
    include: { category: { select: { emoji: true, name: true } } },
    orderBy: { submittedAt: "desc" },
    where: { userId: request.donkey.userId },
  });

  const submissions = rows.map(({ thumbnailKey, videoKey, ...row }) => ({
    ...row,
    hasThumbnail: Boolean(thumbnailKey),
    hasVideo: Boolean(videoKey),
  }));

  return NextResponse.json({ submissions });
});
