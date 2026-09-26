import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { resolveSkills } from "@/cut/server/ai/skillsStore";

export const dynamic = "force-dynamic";

const querySchema = z.object({ agent: z.enum(["cut", "blog"]) });

// The one hosted read both of Cut's own AI chat loops (the live browser
// AiPanel and the headless session — cut/lib/pi/prodDeps.ts and
// serverDeps.ts) and the blog admin agent go through for list_skills/
// read_skill, so a skill an admin adds at /admin/ai/skills reaches every
// agent without a deploy. Lives outside /api/cut/* on purpose: that whole
// prefix 404s on a hosted deploy (Cut's own API is local-only — see
// api/cut/[[...slug]]/route.ts), while this route needs to answer real
// production traffic.
//
// Cut skills are for any signed-in user's own editor; blog skills back the
// admin-only blog chat agent, so that branch needs the same super-user gate
// blog's other admin routes use.
export const GET = withDepCutAuth(async (request) => {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "agent must be \"cut\" or \"blog\"." }, { status: 400 });
  }
  if (parsed.data.agent === "blog" && !(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { index, skills } = await resolveSkills(parsed.data.agent);
  return NextResponse.json({ index, skills });
});
