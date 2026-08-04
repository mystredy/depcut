"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { creditsUrl, NO_CREDITS_MESSAGE, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { hostedPost } from "@/cut/lib/hosted";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatCompletion = { choices: { message: { content: string } }[] };

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "Sign in to Donkey to chat.";
  if (res.status === 402) return NO_CREDITS_MESSAGE;
  const body = (await res.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
    details?: { message?: unknown } | null;
  } | null;
  const message = [body?.message, body?.error].find(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  const detail =
    typeof body?.details?.message === "string" && body.details.message.trim()
      ? body.details.message.trim()
      : null;
  if (detail && detail !== message) return message ? `${message} ${detail}` : detail;
  return message ?? fallback;
}

// A plain multi-turn chat over Donkey's hosted inference route — the same
// /api/inference/chat/completions the Submit Project page's "Generate" buttons
// call for a single turn, here fed the whole running history each send.
export default function AiChatbotPage() {
  const signedOut = useSignedIn() === false;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await hostedPost("/api/inference/chat/completions", { messages: next });
      if (!res.ok) throw new Error(await readError(res, "The assistant didn't respond."));
      const data = (await res.json()) as ChatCompletion;
      const reply = data.choices[0]?.message.content?.trim();
      if (!reply) throw new Error("The assistant returned an empty reply.");
      setMessages((cur) => [...cur, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(
        e instanceof Error
          ? { text: e.message, credits: e.message === NO_CREDITS_MESSAGE }
          : { text: "The assistant didn't respond." }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">AI Chatbot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with Donkey's AI assistant — brainstorm ideas, ask questions, get a second opinion.
        </p>
      </div>

      <div className="flex flex-col overflow-hidden rounded-3xl border bg-card">
        <div ref={listRef} className="max-h-[60vh] min-h-[320px] space-y-3 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Bot className="size-6" />
              <p className="text-sm">Say hello to get started.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex items-start gap-2.5", m.role === "user" && "flex-row-reverse")}
              >
                <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {busy && (
            <div className="flex items-center gap-2.5">
              <div className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                <Bot className="size-3.5" />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Thinking…
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              className="min-h-[40px] w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-[13px] leading-relaxed outline-none focus:border-ring"
              placeholder={signedOut ? "Sign in to chat" : "Message the assistant…"}
              value={input}
              disabled={signedOut}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button size="icon" disabled={!input.trim() || busy || signedOut} onClick={() => void send()}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </div>

          {signedOut ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Chatting runs on your Donkey account.{" "}
              <a className="font-medium text-blue-600 hover:underline dark:text-blue-400" href={signInUrl()}>
                Sign in
              </a>{" "}
              to continue.
            </p>
          ) : (
            error && (
              <p className="text-[11px] leading-relaxed text-red-600">
                {error.text}
                {error.credits && (
                  <>
                    {" "}
                    <a
                      className="font-medium underline hover:no-underline"
                      href={creditsUrl()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Add credits
                    </a>
                  </>
                )}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
