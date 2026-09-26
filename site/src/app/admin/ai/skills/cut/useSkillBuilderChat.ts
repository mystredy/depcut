"use client";

import { useCallback, useRef, useState } from "react";

import { apiFetch } from "@/queries/apiClient";
import type { AdminProjectChatThread, AdminProjectDoc } from "@/queries/admin";

// One chat turn against a chosen Cut project's own history — no tools, just
// the model reasoning over what's injected into `instructions` (see
// buildProjectReference below). Structurally the tool-free half of Cut's own
// hosted chat loop / the blog editor's useBlogAiChat.ts, minus the round
// loop neither of them need without tool calls.
export type SkillBuilderMessage = { id: string; role: "user" | "assistant"; text: string };

type ResponseBody = { output_text?: string };

const BASE_INSTRUCTIONS = [
  "You are helping a DepCut admin write a reusable \"skill\" — a markdown",
  "playbook the Cut video editor's own AI agent reads before working in an",
  "area it's unsure about (see list_skills/read_skill in its tool list).",
  "You're given one real project's edit log (every add/move/trim/delete a",
  "person or the agent made, in order, with timestamps) and every AI chat",
  "thread that project ever had, below. Study the actual pattern in them —",
  "what the person kept redoing, in what order, and why (their own chat",
  "messages often say why) — and propose a skill: a short name (kebab-case)",
  "and step-by-step instructions written the way the existing skills in",
  "cut/server/ai/catalog.ts read (imperative, concrete tool names, no fluff).",
  "Ask the admin questions when the pattern is ambiguous rather than",
  "guessing. When they're happy with a draft, give it back as a fenced code",
  "block so it's easy to copy into the skill form.",
].join(" ");

function buildProjectReference(project: AdminProjectDoc, threads: AdminProjectChatThread[]): string {
  const doc = project.doc as { editLog?: { t: number; summary: string }[] };
  const editLog = Array.isArray(doc.editLog) ? doc.editLog : [];
  const editLogText = editLog.length
    ? editLog.map((e) => `[${new Date(e.t).toISOString()}] ${e.summary}`).join("\n")
    : "(empty — this project has no recorded edit history)";

  const threadsText = threads.length
    ? threads
        .map((t, i) => `### Chat ${i + 1} (updated ${t.updatedAt})\n${JSON.stringify(t.data).slice(0, 8_000)}`)
        .join("\n\n")
    : "(no AI chat threads found for this project)";

  return [
    `<project_reference name="${project.name}">`,
    "## Edit log",
    editLogText,
    "",
    "## AI chat history (raw JSON per thread — read through it for the actual conversation, tool calls included)",
    threadsText,
    "</project_reference>",
  ].join("\n");
}

export function useSkillBuilderChat({
  depcutProvider,
  model,
  project,
  threads,
}: {
  depcutProvider: string;
  model: string;
  project: AdminProjectDoc;
  threads: AdminProjectChatThread[];
}) {
  const [messages, setMessages] = useState<SkillBuilderMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      const history: SkillBuilderMessage[] = [
        ...messages,
        { id: crypto.randomUUID(), role: "user", text: trimmed },
      ];
      setMessages(history);
      setBusy(true);
      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;

      void (async () => {
        try {
          const body = await apiFetch<ResponseBody>("/api/admin/agent-skills/builder-chat", {
            body: JSON.stringify({
              depcutProvider,
              input: history.map((m) => ({ content: [{ text: m.text }], role: m.role })),
              instructions: `${BASE_INSTRUCTIONS}\n\n${buildProjectReference(project, threads)}`,
              model,
            }),
            method: "POST",
            signal: controller.signal,
          });
          setMessages([
            ...history,
            { id: crypto.randomUUID(), role: "assistant", text: (body.output_text ?? "").trim() || "(no response)" },
          ]);
        } catch (err) {
          if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Chat request failed.");
        } finally {
          setBusy(false);
          abortRef.current = null;
        }
      })();
    },
    [busy, depcutProvider, messages, model, project, threads],
  );

  return { busy, error, messages, sendMessage };
}
