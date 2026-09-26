import { hostedGet } from "../hosted";

// Cut's own skills (AI_SKILLS in cut/server/ai/catalog.ts) plus whatever an
// admin has added at /admin/ai/skills, merged server-side by resolveSkills
// and served at GET /api/agent-skills — the one hosted route both the live
// browser AiPanel (prodDeps.ts) and the headless chat loop (serverDeps.ts)
// read list_skills/read_skill from, so a skill added there reaches every
// Cut agent without a deploy. Cached per tab/session: skills change rarely
// enough that a reload is an acceptable way to pick up an edit made mid-session.
let cached: Promise<{ index: string[]; skills: Record<string, string> }> | null = null;

async function loadCutSkills(): Promise<{ index: string[]; skills: Record<string, string> }> {
  cached ??= hostedGet("/api/agent-skills?agent=cut")
    .then(async (res) => {
      if (!res.ok) throw new Error("Could not load skills.");
      return (await res.json()) as { index: string[]; skills: Record<string, string> };
    })
    .catch((e) => {
      cached = null; // don't pin a transient failure for the rest of the session
      throw e;
    });
  return cached;
}

export async function listCutSkills(): Promise<{ skills: string[] }> {
  const { index } = await loadCutSkills();
  return { skills: index };
}

export async function readCutSkill(name: string): Promise<string> {
  const { skills, index } = await loadCutSkills();
  const doc = skills[name];
  if (!doc) throw new Error(`No such skill. Available: ${index.join(", ")}`);
  return doc;
}
