import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { InferenceProviderError } from "@/lib/inference/providers";
import { createProviderRegistry } from "@/lib/inference/router";
import { responseCreateRequestSchema } from "@/lib/inference/schemas";

export const dynamic = "force-dynamic";

// The blog post editor's chat panel — one round of a tool-calling
// conversation. Stateless: the client resends the whole conversation
// (including the current post snapshot, folded into the newest user
// message) every round, same as Cut's own hosted chat loop
// (site/src/cut/lib/geminiChat.ts) replays its whole input each round
// rather than keeping a provider-side session.
//
// Tool-calling needs the Responses API surface (createResponse), not
// completeText — Gemini's completeText silently drops a `tools` field, and
// OpenAI/Anthropic don't implement completeText at all. createResponse is
// also where Cut's own hosted chat already gets its tool-calling from, just
// normally reached through the billed /api/inference/responses gateway.
// Calling registry.responsesProvider(...).createResponse(...) directly here
// keeps this on the same unbilled footing as the admin tool it replaces
// (the old ai-draft route called provider.completeText() directly for the
// same reason) — no x-depcut-client-id, no credits.
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
