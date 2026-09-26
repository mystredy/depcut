import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function requireSuperUser(userId: string) {
  if (await isDepCutSuperUser(userId)) return null;
  return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
}

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers, and hyphens only.");

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    body: z.string().trim().min(1).max(20_000).optional(),
  })
  .strict();

export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  const forbidden = await requireSuperUser(request.depcut.userId);
  if (forbidden) return forbidden;

  const { id } = await context.params;
  const existing = await prisma.agentSkill.findUnique({ where: { id } });
  if (!existing) return notFoundResponse();

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const clash = await prisma.agentSkill.findUnique({
      where: { agent_name: { agent: existing.agent, name: parsed.data.name } },
    });
    if (clash) {
      return NextResponse.json({ error: `A ${existing.agent} skill named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
  }

  const skill = await prisma.agentSkill.update({ data: parsed.data, where: { id } });
  return NextResponse.json({ skill });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  const forbidden = await requireSuperUser(request.depcut.userId);
  if (forbidden) return forbidden;

  const { id } = await context.params;
  const existing = await prisma.agentSkill.findUnique({ select: { id: true }, where: { id } });
  if (!existing) return notFoundResponse();

  await prisma.agentSkill.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
