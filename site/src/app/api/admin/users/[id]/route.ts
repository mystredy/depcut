import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ superUser: z.boolean() }).strict();

type RouteContext = { params: Promise<{ id: string }> };

// Super-user only: toggle another account's super-user flag.
export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can change this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
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

  const existing = await prisma.user.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  const updated = await prisma.user.update({
    data: { superUser: parsed.data.superUser },
    select: { email: true, id: true, superUser: true },
    where: { id },
  });

  return NextResponse.json({ user: updated });
});
