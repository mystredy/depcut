import { prisma } from "@/lib/prisma";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Create a new AI Chatbot conversation row holding its first turn(s). */
export async function createChatGeneration(userId: string, messages: ChatMessage[]): Promise<{ id: string }> {
  return prisma.chatGeneration.create({
    data: { messages, userId },
    select: { id: true },
  });
}

/** Replace an existing conversation's messages with the full running
 * transcript — called after every turn, not just the first. Scoped to the
 * caller's own row; a mismatched id/userId is a silent no-op (0 rows
 * updated) rather than an error, since this is best-effort persistence. */
export async function updateChatGeneration(userId: string, id: string, messages: ChatMessage[]): Promise<void> {
  await prisma.chatGeneration.updateMany({
    data: { messages },
    where: { id, userId },
  });
}
