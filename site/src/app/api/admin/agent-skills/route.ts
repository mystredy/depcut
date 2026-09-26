import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const agentSchema = z.enum(["cut", "blog"]);

// Super-user only — the /admin/ai/skills CRUD list. GET lists one agent's
// admin-authored skills (built-in ones from cut/server/ai/catalog.ts aren't
// rows here, so they don't show up or get edited from this list — see
// resolveSkills in cut/server/ai/skillsStore.ts for where the two merge).
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can view this." }, { status: 403 });
  }

  const agentParam = new URL(request.url).searchParams.get("agent");
  const parsed = agentSchema.safeParse(agentParam);
  if (!parsed.success) {
    return NextResponse.json({ error: "agent must be \"cut\" or \"blog\"." }, { status: 400 });
  }

  const skills = await prisma.agentSkill.findMany({ where: { agent: parsed.data }, orderBy: { name: "asc" } });
  return NextResponse.json({ skills });
});

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers, and hyphens only.");

const createSchema = z
  .object({
    agent: agentSchema,
    name: nameSchema,
    body: z.string().trim().min(1).max(20_000),
  })
  .strict();

export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }

  const existing = await prisma.agentSkill.findUnique({
    where: { agent_name: { agent: parsed.data.agent, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: `A ${parsed.data.agent} skill named "${parsed.data.name}" already exists.` }, { status: 409 });
  }

  const skill = await prisma.agentSkill.create({ data: parsed.data });
  return NextResponse.json({ skill });
});
