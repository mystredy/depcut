import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type AdminAction,
  createActionChallenge,
  generateActionCode,
} from "@/lib/admin/action-verification";
import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { sendAdminActionCode } from "@/lib/email/send-admin-action-code";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({ action: z.enum(["grant-super-user", "revoke-super-user"]) })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

// Super-user only: emails a one-time code to the CALLER's own address, to
// confirm before /api/admin/users/[id]'s PATCH grants or revokes super-user
// access. See lib/admin/action-verification.ts for why this needs no DB row.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await context.params;
  const [admin, target] = await Promise.all([
    prisma.user.findUnique({ select: { email: true }, where: { id: request.depcut.userId } }),
    prisma.user.findUnique({ select: { email: true, superUser: true }, where: { id } }),
  ]);
  if (!admin || !target) {
    return notFoundResponse();
  }

  const action: AdminAction = parsed.data.action;
  const wantsSuperUser = action === "grant-super-user";
  if (target.superUser === wantsSuperUser) {
    return NextResponse.json(
      {
        error: "already_in_that_state",
        message: "This account's super-user status already matches.",
      },
      { status: 409 },
    );
  }

  const code = generateActionCode();
  try {
    await sendAdminActionCode({
      action,
      adminEmail: admin.email,
      code,
      targetEmail: target.email,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "email_failed",
        message: error instanceof Error ? error.message : "Could not send the code.",
      },
      { status: 503 },
    );
  }

  const challenge = createActionChallenge({
    action,
    adminUserId: request.depcut.userId,
    code,
    targetUserId: id,
  });
  return NextResponse.json({ challenge, sentTo: admin.email });
});
