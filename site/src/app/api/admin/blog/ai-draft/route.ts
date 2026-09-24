import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { InferenceProviderError } from "@/lib/inference/providers";
import { createProviderRegistry } from "@/lib/inference/router";

export const dynamic = "force-dynamic";

const draftSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  // "ask" answers a question about context.text and applies nothing.
  // "write" is the original write-or-revise-and-apply action.
  action: z.enum(["ask", "write"]).default("write"),
  // Present when the editor has an existing selection or post body to work
  // from — "write" revises it instead of drafting something new; "ask"
  // answers the question against it (there's nothing to ask about without
  // this, so the client only offers Ask when it has one).
  context: z
    .object({
      type: z.enum(["selection", "post"]),
      text: z.string().trim().min(1).max(200_000),
    })
    .optional(),
});

// The model's reply for a "write" action is split on this line rather than
// parsed as JSON — a blog post body is prose, and asking a text model to
// escape itself into a JSON string reliably is more failure-prone than a
// marker line a Markdown draft is never going to produce on its own.
const BODY_MARKER = "===BODY===";

type Instruction =
  | { kind: "answer"; instruction: string }
  | { kind: "draft"; instruction: string; expectTitle: boolean };

function buildInstruction(
  promptText: string,
  action: z.infer<typeof draftSchema>["action"],
  context: z.infer<typeof draftSchema>["context"],
): Instruction {
  if (action === "ask" && context) {
    const isSelection = context.type === "selection";
    return {
      instruction: [
        `Answer the question below about the following ${isSelection ? "excerpt from a blog post" : "blog post"}.`,
        "Respond with a plain, concise answer only — no Markdown formatting, no commentary, no restating the question.",
        "",
        `Question: ${promptText}`,
        "",
        `${isSelection ? "Excerpt" : "Post"}:`,
        context.text,
      ].join("\n"),
      kind: "answer",
    };
  }

  if (!context) {
    return {
      expectTitle: true,
      instruction: [
        "Write a blog post draft in Markdown for the given topic.",
        "Respond in exactly this format, with no extra commentary before or after:",
        "",
        "TITLE: <post title, plain text, no Markdown>",
        BODY_MARKER,
        "<the full post body in Markdown, using ## headings and paragraphs where natural>",
        "",
        `Topic: ${promptText}`,
      ].join("\n"),
      kind: "draft",
    };
  }

  const isSelection = context.type === "selection";
  return {
    expectTitle: false,
    instruction: [
      `Revise the following ${isSelection ? "excerpt from a blog post" : "blog post"} per the instruction below.`,
      "Respond with ONLY the revised Markdown — no commentary, no title, no surrounding explanation.",
      isSelection
        ? "Return just the replacement text for this excerpt, matching its surrounding style unless the instruction says otherwise."
        : "Return the complete revised post body.",
      "",
      `Instruction: ${promptText}`,
      "",
      `${isSelection ? "Excerpt" : "Current post"}:`,
      context.text,
    ].join("\n"),
    kind: "draft",
  };
}

// Internal admin-tool call, not the billed external-client path — skips the
// x-depcut-client-id/credits machinery /api/inference/responses requires,
// same as every other /api/admin/blog route only checks super-user auth.
export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = draftSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const registry = createProviderRegistry();
  let provider;
  try {
    provider = registry.textProvider(false);
  } catch (error) {
    return errorResponse(error, "No AI provider is configured.");
  }
  if (!provider.completeText) {
    return NextResponse.json({ error: "The configured AI provider can't generate text." }, { status: 503 });
  }

  const built = buildInstruction(parsed.data.prompt, parsed.data.action, parsed.data.context);

  let result;
  try {
    result = await provider.completeText({
      messages: [{ role: "user", content: built.instruction }],
      stream: false,
    });
  } catch (error) {
    return errorResponse(error, "AI generation failed.");
  }

  const body = result.body as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";

  if (built.kind === "answer") {
    const answer = text.trim();
    if (!answer) {
      return NextResponse.json({ error: "The AI didn't return an answer — try again." }, { status: 502 });
    }
    return NextResponse.json({ answer });
  }

  if (!built.expectTitle) {
    const contentMarkdown = text.trim();
    if (!contentMarkdown) {
      return NextResponse.json({ error: "The AI response was empty — try again." }, { status: 502 });
    }
    return NextResponse.json({ contentMarkdown });
  }

  const markerIndex = text.indexOf(BODY_MARKER);
  if (markerIndex === -1) {
    return NextResponse.json(
      { error: "The AI response wasn't in the expected format — try again." },
      { status: 502 },
    );
  }

  const title = text.slice(0, markerIndex).replace(/^TITLE:\s*/i, "").trim();
  const contentMarkdown = text.slice(markerIndex + BODY_MARKER.length).trim();
  if (!title || !contentMarkdown) {
    return NextResponse.json({ error: "The AI response was empty — try again." }, { status: 502 });
  }

  return NextResponse.json({ contentMarkdown, title });
});

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof InferenceProviderError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 502 });
}
