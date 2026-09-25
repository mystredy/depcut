"use client";

import { useCallback, useRef, useState } from "react";

import { apiFetch } from "@/queries/apiClient";

import { BLOG_AI_TOOLS, runBlogAiTool, type BlogEditorActions, type BlogToolResult } from "./tools";

// One chat turn: request → (tool round-trips) → reply — structurally
// Cut's own hosted chat loop (site/src/cut/lib/geminiChat.ts) with the SSE
// streaming deleted, since there's no streaming route for this (see
// api/admin/blog/ai-chat/route.ts's own comment) and blog turns are short
// enough that a "thinking…" wait is fine.
const MAX_TOOL_ROUNDS = 8;

type Item = Record<string, unknown>;

export type BlogChatToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: BlogToolResult;
  thoughtSignature?: string;
};

export type BlogChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; toolCalls: BlogChatToolCall[] };

type ResponseBody = {
  output_text?: string;
  output?: { type?: string; id?: string; name?: string; arguments?: unknown; thoughtSignature?: string }[];
};

const INSTRUCTIONS = [
  "You are DepCut's blog editing assistant. You can see this post's current",
  "title, excerpt, tags, and body (a <post_state> block on the latest",
  "message), and you can change any of them directly with the tools you're",
  "given — don't ask permission first for an edit the user already asked",
  "for. Use plain text only to answer a question, explain what you did, or",
  "ask for clarification — never restate the whole post back in chat text,",
  "since your tools already show the change in the editor. Keep replies",
  "short.",
].join(" ");

const toolDeclarations = () =>
  BLOG_AI_TOOLS.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.inputSchema }));

// The conversation replayed as Responses input items. Past assistant turns
// keep their text plus which tools they ran (names only — the model doesn't
// need the arguments/results again, just that the work already happened),
// so a replay never re-runs a finished edit. The post snapshot rides on the
// newest user message alone, same as Cut folds its <editor_state> into just
// the latest turn rather than every one.
function inputFromMessages(messages: BlogChatMessage[], postState: Record<string, unknown>): Item[] {
  const lastUserId = messages.findLast((m) => m.role === "user")?.id;
  return messages.map((m): Item => {
    if (m.role === "user") {
      const text = m.id === lastUserId ? `${m.text}\n\n<post_state>\n${JSON.stringify(postState)}\n</post_state>` : m.text;
      return { role: "user", content: [{ text }] };
    }
    const text =
      m.toolCalls.length > 0 ? `${m.text}\n\n<tools_ran>${m.toolCalls.map((c) => c.name).join(", ")}</tools_ran>` : m.text;
    return { role: "assistant", content: text.trim() ? [{ text }] : [] };
  });
}

export function useBlogAiChat({
  depcutProvider,
  model,
  actions,
  getPostState,
  initialMessages,
  onSettled,
}: {
  depcutProvider: string;
  model: string;
  actions: BlogEditorActions;
  getPostState: () => Record<string, unknown>;
  initialMessages?: BlogChatMessage[];
  onSettled?: (messages: BlogChatMessage[]) => void;
}) {
  const [messages, setMessages] = useState<BlogChatMessage[]>(initialMessages ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runTurn = useCallback(
    async (history: BlogChatMessage[]) => {
      setBusy(true);
      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;

      let input = inputFromMessages(history, getPostState());
      let finalMessages = history;
      let settled = false;
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const body = await apiFetch<ResponseBody>("/api/admin/blog/ai-chat", {
            body: JSON.stringify({
              depcutProvider,
              input,
              instructions: INSTRUCTIONS,
              model,
              tools: toolDeclarations(),
            }),
            method: "POST",
            signal: controller.signal,
          });

          const text = (body.output_text ?? "").trim();
          const calls = (body.output ?? []).filter((o) => o.type === "function_call");

          if (calls.length === 0) {
            finalMessages = [
              ...finalMessages,
              { id: crypto.randomUUID(), role: "assistant", text: text || "(no response)", toolCalls: [] },
            ];
            setMessages(finalMessages);
            settled = true;
            break;
          }

          const toolCalls: BlogChatToolCall[] = [];
          const assistantParts: Item[] = text ? [{ text }] : [];
          const responseParts: Item[] = [];
          for (const call of calls) {
            const name = String(call.name ?? "unknown_function");
            const args =
              call.arguments && typeof call.arguments === "object" && !Array.isArray(call.arguments)
                ? (call.arguments as Record<string, unknown>)
                : {};
            const toolCallId = call.id ? String(call.id) : crypto.randomUUID().slice(0, 12);
            const assistantPart: Item = { functionCall: { id: toolCallId, name, args } };
            if (call.thoughtSignature) assistantPart.thoughtSignature = call.thoughtSignature;
            assistantParts.push(assistantPart);

            const result = runBlogAiTool(name, args, actions);
            toolCalls.push({ args, id: toolCallId, name, result, thoughtSignature: call.thoughtSignature });
            responseParts.push({ id: toolCallId, name, response: result, type: "function_response" });
          }

          finalMessages = [...finalMessages, { id: crypto.randomUUID(), role: "assistant", text, toolCalls }];
          setMessages(finalMessages);

          input = [...input, { content: assistantParts, role: "assistant" }, { content: responseParts, role: "user" }];
        }

        if (!settled) {
          finalMessages = [
            ...finalMessages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: "Reached this turn's step limit — say “keep going” if there's more to do.",
              toolCalls: [],
            },
          ];
          setMessages(finalMessages);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Chat request failed.");
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
        onSettled?.(finalMessages);
      }
    },
    [actions, depcutProvider, getPostState, model, onSettled],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      const history: BlogChatMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", text: trimmed }];
      setMessages(history);
      void runTurn(history);
    },
    [busy, messages, runTurn],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { busy, error, messages, sendMessage, stop };
}
