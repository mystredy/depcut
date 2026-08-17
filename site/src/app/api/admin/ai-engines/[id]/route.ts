import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    status: z.enum(["active", "standby"]).optional(),
    // Moves this engine's priority above every other row's.
    escalate: z.boolean().optional(),
  })
  .strict();

export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.aiEngine.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  const parsed = updateSchema.safeParse(await request.json());
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

  let priority: number | undefined;
  if (parsed.data.escalate) {
    const top = await prisma.aiEngine.findFirst({ orderBy: { priority: "desc" } });
    priority = (top?.priority ?? 0) + 1;
  }

  const engine = await prisma.aiEngine.update({
    data: { priority, status: parsed.data.status },
    where: { id },
  });

  return NextResponse.json({ engine });
});
