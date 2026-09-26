"use client";

import { useCallback, useRef, useState } from "react";

import { AI_TOOLS } from "@/cut/server/ai/catalog";
import { apiFetch } from "@/queries/apiClient";
import type { AdminProjectChatThread, AdminProjectDoc } from "@/queries/admin";

// A chat turn against a chosen Cut project's own history, plus two read-only
// tools onto this site's own codebase (list_repo_dir/read_repo_file) so the
// model can check how something is actually implemented instead of guessing
// from the tool catalog's one-line descriptions. Structurally the blog
// editor's own useBlogAiChat.ts turn loop, swapped to a fixed, small
// tool set instead of one that edits anything.
const MAX_TOOL_ROUNDS = 8;

type Item = Record<string, unknown>;

export type SkillBuilderToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: { ok: true; summary: string } | { ok: false; error: string };
};

export type SkillBuilderMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; toolCalls: SkillBuilderToolCall[] };

type ResponseBody = {
  output_text?: string;
  output?: { type?: string; id?: string; name?: string; arguments?: unknown }[];
};

const REPO_TOOLS = [
  {
    description:
      "List the files and subdirectories under a path in this website's own codebase (the depcut/site repo, straight from GitHub). Use this to find what exists before reading a file — you don't already know the exact tree. Empty path lists the repo root.",
    inputSchema: {
      additionalProperties: false,
      properties: { path: { description: "Repo-relative directory path, e.g. \"site/src/cut/components\".", type: "string" } },
      type: "object",
    },
    name: "list_repo_dir",
  },
  {
    description:
      "Read one file's full text content from this website's own codebase, by its repo-relative path (e.g. \"site/src/cut/server/ai/catalog.ts\"). Only site/src, site/prisma, and the repo-root docs/ are readable.",
    inputSchema: {
      additionalProperties: false,
      properties: { path: { description: "Repo-relative file path.", type: "string" } },
      required: ["path"],
      type: "object",
    },
    name: "read_repo_file",
  },
];

const toolDeclarations = () =>
  REPO_TOOLS.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.inputSchema }));

async function runRepoTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; summary: string; data?: unknown } | { ok: false; error: string }> {
  const path = typeof args.path === "string" ? args.path : "";
  try {
    if (name === "list_repo_dir") {
      const res = await apiFetch<{ entries: { name: string; kind: string }[] }>(
        `/api/admin/agent-skills/repo?action=list&path=${encodeURIComponent(path)}`,
      );
      return { data: res.entries, ok: true, summary: `${res.entries.length} entries in "${path || "/"}".` };
    }
    if (name === "read_repo_file") {
      if (!path) return { error: "path is required.", ok: false };
      const res = await apiFetch<{ content: string }>(
        `/api/admin/agent-skills/repo?action=read&path=${encodeURIComponent(path)}`,
      );
      return { data: res.content, ok: true, summary: `Read "${path}" (${res.content.length} chars).` };
    }
    return { error: `Unknown tool: ${name}`, ok: false };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Tool call failed.", ok: false };
  }
}

const BASE_INSTRUCTIONS = [
  "You are helping a DepCut admin write a reusable \"skill\" — a markdown",
  "playbook the Cut video editor's own AI agent reads before working in an",
  "area it's unsure about (see list_skills/read_skill in its tool list).",
  "You're given the Cut agent's full tool catalog, every skill it can",
  "already read, one real project's edit log (every add/move/trim/delete a",
  "person or the agent made, in order, with timestamps), and every AI chat",
  "thread that project ever had — all below. You can also call",
  "list_repo_dir/read_repo_file to check this website's own source when a",
  "tool's one-line description isn't enough to be sure how it actually",
  "behaves. Study the actual pattern in the log and chats — what the person",
  "kept redoing, in what order, and why (their own chat messages often say",
  "why) — and propose a skill: a short name (kebab-case) and step-by-step",
  "instructions written the way the existing skills read (imperative,",
  "concrete tool names FROM THE CATALOG BELOW ONLY — never invent a tool",
  "that isn't listed there). Check the existing skills first: if one",
  "already covers this, say so and propose refining it (same name) instead",
  "of a near-duplicate. Ask the admin questions when the pattern is",
  "ambiguous rather than guessing. When they're happy with a draft, give it",
  "back as a fenced code block so it's easy to copy into the skill form.",
].join(" ");

/** Cut's whole tool catalog, name + description only (no schemas — the
 * builder isn't calling them, just needs to reference real names). Static
 * and small enough to inline every turn rather than fetch. */
const toolCatalogText = AI_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n");

// The current full skill set (built-in + admin-authored, already merged —
// see resolveSkills) — fetched once per page load and reused across every
// project the admin picks, same route the Cut agent itself reads.
let skillCatalog: Promise<{ index: string[]; skills: Record<string, string> }> | null = null;

async function loadSkillCatalogText(): Promise<string> {
  skillCatalog ??= apiFetch<{ index: string[]; skills: Record<string, string> }>("/api/agent-skills?agent=cut").catch(
    (e) => {
      skillCatalog = null;
      throw e;
    },
  );
  const { index, skills } = await skillCatalog;
  if (index.length === 0) return "(none yet)";
  return index.map((name) => `### ${name}\n${skills[name]}`).join("\n\n");
}

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

// Past assistant turns keep their text plus which repo tools they ran (names
// only), so a replay never re-fetches the same file — same compaction
// useBlogAiChat.ts's inputFromMessages does for its own tool calls.
function inputFromMessages(messages: SkillBuilderMessage[]): Item[] {
  return messages.map((m): Item => {
    if (m.role === "user") return { content: [{ text: m.text }], role: "user" };
    const text = m.toolCalls.length > 0 ? `${m.text}\n\n<tools_ran>${m.toolCalls.map((c) => c.name).join(", ")}</tools_ran>` : m.text;
    return { content: text.trim() ? [{ text }] : [], role: "assistant" };
  });
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
      const history: SkillBuilderMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", text: trimmed }];
      setMessages(history);
      setBusy(true);
      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;

      void (async () => {
        try {
          const skillsText = await loadSkillCatalogText();
          const instructions = [
            BASE_INSTRUCTIONS,
            "\n## Cut agent's tool catalog",
            toolCatalogText,
            "\n## Skills the Cut agent can already read",
            skillsText,
            "\n" + buildProjectReference(project, threads),
          ].join("\n");

          let input = inputFromMessages(history);
          let finalMessages = history;
          let settled = false;

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const body = await apiFetch<ResponseBody>("/api/admin/agent-skills/builder-chat", {
              body: JSON.stringify({ depcutProvider, input, instructions, model, tools: toolDeclarations() }),
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

            const toolCalls: SkillBuilderToolCall[] = [];
            const assistantParts: Item[] = text ? [{ text }] : [];
            const responseParts: Item[] = [];
            for (const call of calls) {
              const name = String(call.name ?? "unknown_function");
              const args =
                call.arguments && typeof call.arguments === "object" && !Array.isArray(call.arguments)
                  ? (call.arguments as Record<string, unknown>)
                  : {};
              const toolCallId = call.id ? String(call.id) : crypto.randomUUID().slice(0, 12);
              assistantParts.push({ functionCall: { args, id: toolCallId, name } });

              const result = await runRepoTool(name, args);
              toolCalls.push({ args, id: toolCallId, name, result });
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
