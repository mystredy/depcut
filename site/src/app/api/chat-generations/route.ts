import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { createChatGeneration, updateChatGeneration } from "@/lib/chatGenerations/db";

export const dynamic = "force-dynamic";

const messageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(50_000),
  })
  .strict();

const bodySchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    messages: z.array(messageSchema).min(1).max(500),
  })
  .strict();

// Called after every AI Chatbot turn (see cut/lib/chatGenerationPersist.ts)
// with the full running transcript. No id yet on the first turn — creates
// the conversation row and hands back its id for every later turn to reuse.
export const POST = withDepCutAuth(async (request) => {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { id, messages } = parsed.data;

  if (id) {
    await updateChatGeneration(request.depcut.userId, id, messages);
    return NextResponse.json({ id });
  }

  const row = await createChatGeneration(request.depcut.userId, messages);
  return NextResponse.json(row, { status: 201 });
});
