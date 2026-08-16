import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { notifyUser } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start-review") }),
  z.object({
    action: z.literal("approve"),
    reviewScore: z.number().int().min(1).max(10),
    creatorWorkdone: z.number().int().min(0).max(100).optional(),
    remark: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    remark: z.string().trim().max(2000).optional(),
  }),
]);

// Super-user only. Advances a submission through the review lifecycle:
// Pending -> InReview -> Qualified/Disqualified. Approving computes
// earnedRates from the linked Task's maxRates (or the submission's own
// maxRates) scaled by the assigned score out of 10.
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    include: { task: { select: { maxRates: true } } },
    where: { id },
  });
  if (!submission) {
    return notFoundResponse();
  }

  const parsed = actionSchema.safeParse(await request.json());
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

  const input = parsed.data;
  const reviewerId = request.donkey.userId;
  const reviewer = await prisma.user.findUnique({
    select: { displayName: true, name: true },
    where: { id: reviewerId },
  });
  const reviewerName = reviewer?.displayName ?? reviewer?.name ?? "Admin";

  let updated;
  if (input.action === "start-review") {
    updated = await prisma.submission.update({
      data: { reviewStartedAt: new Date(), reviewStatus: "InReview" },
      where: { id },
    });
  } else if (input.action === "approve") {
    const maxRates = submission.task?.maxRates ?? submission.maxRates ?? 10;
    const earnedRates = Math.round((maxRates * input.reviewScore) / 10);
    const creatorWorkdone = input.creatorWorkdone ?? 50;
    [updated] = await prisma.$transaction([
      prisma.submission.update({
        data: {
          creatorWorkdone,
          publisherWorkdone: 100 - creatorWorkdone,
          earnedRates,
          maxRates,
          reviewCompletedAt: new Date(),
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          reviewedByName: reviewerName,
          reviewRemark: input.remark,
          reviewScore: input.reviewScore,
          reviewStatus: "Qualified",
          statusRemark: input.remark,
          status: "Approved",
        },
        where: { id },
      }),
      prisma.notification.create(
        notifyUser({
          body: `"${submission.title}" earned ${earnedRates} Rates.${input.remark ? ` ${input.remark}` : ""}`,
          link: "/app/creator-hub/my-projects",
          title: "Submission approved",
          userId: submission.userId,
        }),
      ),
    ]);
  } else {
    [updated] = await prisma.$transaction([
      prisma.submission.update({
        data: {
          reviewCompletedAt: new Date(),
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          reviewedByName: reviewerName,
          reviewRemark: input.remark,
          reviewStatus: "Disqualified",
          statusRemark: input.remark,
          status: "Rejected",
        },
        where: { id },
      }),
      prisma.notification.create(
        notifyUser({
          body: `"${submission.title}" wasn't approved.${input.remark ? ` ${input.remark}` : ""}`,
          link: "/app/creator-hub/my-projects",
          title: "Submission rejected",
          userId: submission.userId,
        }),
      ),
    ]);
  }

  return NextResponse.json({
    submission: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      reviewStartedAt: updated.reviewStartedAt?.toISOString() ?? null,
      reviewCompletedAt: updated.reviewCompletedAt?.toISOString() ?? null,
      submittedAt: updated.submittedAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});
