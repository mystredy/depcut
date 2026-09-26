import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { InferenceProviderError } from "@/lib/inference/providers";
import { createProviderRegistry } from "@/lib/inference/router";
import { responseCreateRequestSchema } from "@/lib/inference/schemas";

export const dynamic = "force-dynamic";

// The AI Skill Builder's chat (/admin/ai/skills/cut) — one round of a plain
// conversation, no tools. A chosen Cut project's edit log and AI chat
// history are folded into the first message client-side (see
// useSkillBuilderChat.ts), so the model just reasons over that context and
// proposes skill text; the admin copies what they want into the skill form
// and saves it as an AgentSkill row themselves. Structurally identical to
// the blog post editor's own chat round (api/admin/blog/ai-chat/route.ts) —
// same unbilled, stateless, tool-free-when-unneeded shape — kept as its own
// route rather than shared so blog and Cut skill-building stay unentangled.
export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = responseCreateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const registry = createProviderRegistry();
  let provider;
  try {
    provider = registry.responsesProvider(parsed.data);
  } catch (error) {
    return errorResponse(error, "No AI provider is configured.");
  }
  if (!provider.createResponse) {
    return NextResponse.json({ error: "The configured AI provider can't chat." }, { status: 503 });
  }

  try {
    const result = await provider.createResponse(parsed.data);
    return NextResponse.json(result.body);
  } catch (error) {
    return errorResponse(error, "AI chat request failed.");
  }
});

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof InferenceProviderError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 502 });
}
