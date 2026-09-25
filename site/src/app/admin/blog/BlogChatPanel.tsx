"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, History, Loader2, Plus, Sparkles, Trash2, Wrench, X } from "lucide-react";
import Markdown from "react-markdown";

import { baseMarkdownComponents } from "@/cut/components/markdownComponents";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { anthropicModels } from "@/lib/inference/anthropic-models";
import { geminiModels } from "@/lib/inference/gemini-models";
import { openaiModels } from "@/lib/inference/openai-models";
import { cn } from "@/lib/utils";
import {
  fetchBlogChatThread,
  useBlogChatThreads,
  useDeleteBlogChatThread,
  useSaveBlogChatThread,
} from "@/queries/admin";

import { useBlogAiChat, type BlogChatMessage } from "./aiChat/useBlogAiChat";
import type { BlogEditorActions } from "./aiChat/tools";

// All three are always-hosted (sign-in + credits infra, no local CLI to
// probe for availability like Cut's ModelSelector has to) — a plain fixed
// list is enough, no favorites/installed-provider logic to port.
const MODELS = [
  { depcutProvider: "gemini", id: geminiModels.flash, label: "Gemini Flash" },
  { depcutProvider: "openai", id: openaiModels.chat, label: "GPT-5.5" },
  { depcutProvider: "anthropic", id: anthropicModels.chat, label: "Sonnet 5" },
];

const SUGGESTIONS = [
  "Write an excerpt for this post",
  "Suggest 3-5 tags",
  "Tighten this up",
  "Give it a punchier title",
  "Add a closing call-to-action",
  "What's this post missing?",
];

function deriveTitle(messages: BlogChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  return firstUser ? firstUser.text.slice(0, 60) : "New chat";
}

// The post editor's persistent AI chat panel — a docked side panel (not a
// modal), architecturally mirroring Cut's own AiPanel/ChatSession: thread
// history, a model picker, and tool calls that edit the post directly as
// the agent talks. See aiChat/useBlogAiChat.ts for the turn loop and
// aiChat/tools.ts for what it can actually change.
export function BlogChatPanel({
  postId,
  actions,
  getPostState,
  onClose,
}: {
  postId: string;
  actions: BlogEditorActions;
  getPostState: () => Record<string, unknown>;
  onClose: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const [initialMessages, setInitialMessages] = useState<BlogChatMessage[]>([]);
  const [modelIndex, setModelIndex] = useState(0);
  const model = MODELS[modelIndex];

  const threads = useBlogChatThreads(postId);
  const saveThread = useSaveBlogChatThread(postId);
  const deleteThread = useDeleteBlogChatThread(postId);

  const newChat = () => {
    setThreadId(crypto.randomUUID());
    setInitialMessages([]);
    setHistoryOpen(false);
  };

  const openThread = async (id: string) => {
    const thread = await fetchBlogChatThread(postId, id);
    setThreadId(id);
    setInitialMessages(Array.isArray(thread.data) ? (thread.data as BlogChatMessage[]) : []);
    setHistoryOpen(false);
  };

  return (
    <aside className="relative flex min-h-0 w-[340px] shrink-0 animate-in flex-col border-l border-border bg-card duration-300 ease-out slide-in-from-right-full max-[900px]:fixed max-[900px]:inset-y-0 max-[900px]:right-0 max-[900px]:z-50 max-[900px]:w-full max-[900px]:max-w-[340px] max-[900px]:shadow-[-16px_0_40px_rgba(0,0,0,0.14)]">
      <div className="flex h-[46px] shrink-0 items-center gap-1.5 border-b border-border pr-2 pl-3.5">
        <Sparkles className="size-3.5 text-primary" />
        <p className="text-xs font-semibold">Blog AI</p>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          title="Past threads"
          aria-pressed={historyOpen}
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <History className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" title="New chat" onClick={newChat}>
          <Plus className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" title="Close" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      {historyOpen && (
        <div className="absolute inset-x-0 top-[46px] z-10 max-h-72 overflow-y-auto border-b border-border bg-card shadow-lg">
          {threads.isLoading ? (
            <p className="p-3 text-xs text-muted-foreground">Loading…</p>
          ) : !threads.data?.threads.length ? (
            <p className="p-3 text-xs text-muted-foreground">No past chats on this post yet.</p>
          ) : (
            threads.data.threads.map((t) => (
              <div key={t.id} className="flex items-center gap-1 border-b border-border/50 px-3 py-2 last:border-b-0 hover:bg-muted">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-xs text-foreground"
                  onClick={() => void openThread(t.id)}
                >
                  {t.title}
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Delete thread"
                  onClick={() => {
                    deleteThread.mutate(t.id);
                    if (t.id === threadId) newChat();
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      <BlogChatSession
        key={threadId}
        actions={actions}
        depcutProvider={model.depcutProvider}
        getPostState={getPostState}
        initialMessages={initialMessages}
        model={model.id}
        modelIndex={modelIndex}
        onModelChange={setModelIndex}
        onTurnSettled={(messages) => {
          if (messages.length === 0) return;
          saveThread.mutate({ chatId: threadId, data: messages, title: deriveTitle(messages) });
        }}
      />
    </aside>
  );
}

function BlogChatSession({
  actions,
  depcutProvider,
  getPostState,
  initialMessages,
  model,
  modelIndex,
  onModelChange,
  onTurnSettled,
}: {
  actions: BlogEditorActions;
  depcutProvider: string;
  getPostState: () => Record<string, unknown>;
  initialMessages: BlogChatMessage[];
  model: string;
  modelIndex: number;
  onModelChange: (index: number) => void;
  onTurnSettled: (messages: BlogChatMessage[]) => void;
}) {
  const { busy, error, messages, sendMessage } = useBlogAiChat({
    actions,
    depcutProvider,
    getPostState,
    initialMessages,
    model,
    onSettled: onTurnSettled,
  });
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const submit = () => {
    if (!draft.trim() || busy) return;
    sendMessage(draft);
    setDraft("");
  };

  return (
    <>
      <div ref={scrollRef} className="ai-messages min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3 pt-6">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              I can see this post&apos;s title, excerpt, tags, and body — and edit it for you.
              Tell me what to change, or ask anything about the post.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  className="ai-suggestion rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-input hover:text-foreground"
                  onClick={() => sendMessage(sug)}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-1", m.role === "user" && "items-end")}>
              {m.text && (
                <div
                  className={cn(
                    "ai-md max-w-[85%] rounded-xl px-2.5 py-1.5 text-[12.5px] leading-relaxed",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <Markdown components={baseMarkdownComponents}>{m.text}</Markdown>
                </div>
              )}
              {m.role === "assistant" &&
                m.toolCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10.5px] text-muted-foreground"
                  >
                    <Wrench className="size-3" />
                    {call.result.ok ? call.result.summary : `${call.name} failed: ${call.result.error}`}
                  </div>
                ))}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Thinking…
            </div>
          )}
          {error && <p className="text-[11.5px] text-destructive">{error}</p>}
        </div>
      </div>

      <div className="shrink-0 px-2.5 pb-2.5">
        <div className="relative rounded-xl border border-input bg-background transition-colors focus-within:border-ring">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder="Ask about this post, or tell me what to change…"
            className="ai-input max-h-56 w-full resize-none overflow-y-auto bg-transparent px-3 pt-2 text-[12.5px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
          />
          <div className="flex items-center gap-1 px-1.5 pb-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger className="ai-model-trigger flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Sparkles className="size-3" />
                {MODELS[modelIndex].label}
                <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {MODELS.map((m, i) => (
                  <DropdownMenuItem key={m.id} onClick={() => onModelChange(i)}>
                    {m.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex-1" />
            <Button type="button" size="icon-sm" disabled={!draft.trim() || busy} onClick={submit}>
              <ArrowUp className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
