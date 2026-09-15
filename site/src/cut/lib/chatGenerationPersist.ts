import { hostedPost } from "./hosted";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Best-effort: save the AI Chatbot's running conversation to the database.
 * Called after every turn with the full transcript, alongside the in-memory
 * message list the page itself already keeps. Returns the conversation's id
 * so the caller can pass it back on the next turn (undefined on the first
 * call, or if the save fails) — omitting it always starts a new row rather
 * than silently dropping history into the wrong conversation. */
export async function persistChat(messages: ChatMessage[], id?: string): Promise<string | undefined> {
  try {
    const res = await hostedPost("/api/chat-generations", id ? { id, messages } : { messages });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { id: string };
    return data.id;
  } catch {
    return undefined;
  }
}
