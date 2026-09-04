import { NextResponse } from "next/server";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { jobStatusResponse } from "@/lib/jobs/queue";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

// Poll one background job for its outcome.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }
  const { jobId } = await context.params;
  const job = await prisma.asyncJob.findUnique({ where: { id: jobId } });
  if (!job) return notFoundResponse();
  return jobStatusResponse(job);
});
