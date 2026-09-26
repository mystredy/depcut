import { prisma } from "@/lib/prisma";

import { AI_SKILLS } from "./catalog";

/** Every agent that has its own skill library. Cut ships a built-in set
 * (AI_SKILLS below); blog has none built in — every blog skill is admin-authored. */
export type SkillAgent = "cut" | "blog";

const BUILT_IN: Record<SkillAgent, Record<string, string>> = {
  blog: {},
  cut: AI_SKILLS,
};

/** The skill set an agent's list_skills/read_skill tools answer from: the
 * code-shipped ones (reviewed and versioned like any other prompt text, cut
 * only) plus whatever an admin has added or edited at /admin/ai/skills — a
 * DB row with the same name as a built-in skill replaces it, so a built-in
 * can be refined without a deploy. Server-only (reads Prisma directly); the
 * browser's own AiPanel and the headless chat loop both reach this through
 * the hosted /api/agent-skills route instead — see cut/lib/pi/prodDeps.ts
 * and serverDeps.ts. */
export async function resolveSkills(
  agent: SkillAgent
): Promise<{ index: string[]; skills: Record<string, string> }> {
  const skills: Record<string, string> = { ...BUILT_IN[agent] };
  const rows = await prisma.agentSkill.findMany({ where: { agent }, orderBy: { name: "asc" } });
  for (const row of rows) skills[row.name] = row.body;
  return { index: Object.keys(skills), skills };
}
