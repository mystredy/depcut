import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { ownedFlow, renameFlow } from "@/lib/flows/db";
import { submitFlowGeneration } from "@/lib/flows/submit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

const createSchema = z
  .object({
    kind: z.enum(["image", "video"]),
    prompt: z.string().trim().min(1).max(20_000),
    // Image has one provider today, so its composer never sends this — the
    // gateway resolves it from the model id alone, same as the standalone
    // Text to Image page's own request. Video always sends it (Omni vs Veo).
    provider: z.string().min(1).max(100).optional(),
    model: z.string().min(1).max(256),
    tier: z.string().min(1).max(100),
    refMode: z.string().min(1).max(50).optional(),
    inputs: z.record(z.string(), z.unknown()).optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    // One key per intended generation, minted client-side once — see
    // submitFlowGeneration's own doc comment for how this prevents a
    // network-level retry of this exact request from billing twice.
    idempotencyKey: z.string().min(1).max(200),
  })
  .strict();

/** Names shorter than this stand as the whole thread name; a longer prompt
 * is cut at a word boundary near this length with an ellipsis, the same
 * truncation the standalone tool pages already use for history summaries. */
const AUTO_NAME_MAX = 60;

function autoName(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= AUTO_NAME_MAX) return trimmed;
  const cut = trimmed.slice(0, AUTO_NAME_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 20 ? cut.slice(0, lastSpace) : cut}…`;
}

// Generate — one image or video inside this Flow's thread. Billed the same
// as the standalone tool pages (see submit.ts): this route wraps the real
// inference-gateway call, it doesn't reimplement it.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // The thread takes its name from its first prompt, same as a chat thread's
  // title — only while it's still sitting on the "New Flow" default, so a
  // rename the user actually chose is never overwritten.
  const isFirst = (await prisma.flowGeneration.count({ where: { flowId: id } })) === 0;
  if (isFirst && flow.name === "New Flow") {
    await renameFlow(id, autoName(body.prompt));
  }

  try {
    const outcome = await submitFlowGeneration(request.headers, {
      flowId: id,
      userId: request.donkey.userId,
      kind: body.kind,
      prompt: body.prompt,
      provider: body.provider,
      model: body.model,
      tier: body.tier,
      idempotencyKey: body.idempotencyKey,
      ...(body.refMode ? { refMode: body.refMode } : {}),
      ...(body.inputs ? { inputs: body.inputs } : {}),
      ...(body.parameters ? { parameters: body.parameters } : {}),
    });
    return NextResponse.json(outcome, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return NextResponse.json({ error: "Generation failed", message }, { status: 502 });
  }
});
