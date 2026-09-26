"use client";

import { useRef, useState } from "react";
import { ChevronDown, Loader2, Sparkles, X } from "lucide-react";
import Markdown from "react-markdown";

import { baseMarkdownComponents } from "@/cut/components/markdownComponents";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { anthropicModels } from "@/lib/inference/anthropic-models";
import { geminiModels } from "@/lib/inference/gemini-models";
import { openaiModels } from "@/lib/inference/openai-models";
import { cn } from "@/lib/utils";
import { useAdminContentProjects, useAdminProjectChats, useAdminProjectDoc } from "@/queries/admin";

import { useSkillBuilderChat } from "./useSkillBuilderChat";

const MODELS = [
  { depcutProvider: "gemini", id: geminiModels.flash, label: "Gemini Flash" },
  { depcutProvider: "openai", id: openaiModels.chat, label: "GPT-5.5" },
  { depcutProvider: "anthropic", id: anthropicModels.chat, label: "Sonnet 5" },
];

/** The last fenced code block in a reply, or the whole reply if it has none —
 * the model is told to hand back a finished draft that way. */
function extractDraft(text: string): string {
  const blocks = [...text.matchAll(/```(?:[a-z]*\n)?([\s\S]*?)```/g)];
  return (blocks.at(-1)?.[1] ?? text).trim();
}

/** Pick a real Cut project, see its edit log and every AI chat thread it
 * ever had, and talk to a model about the pattern in them — the result is a
 * drafted skill the admin reviews and saves themselves (AgentSkillsList's
 * create dialog does the actual write). No tools: the model just reasons
 * over what's injected into instructions (see useSkillBuilderChat). */
export function SkillBuilderPanel({ onUseAsSkill }: { onUseAsSkill: (body: string) => void }) {
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const projects = useAdminContentProjects(projectId ? {} : { q: search });

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Skill Builder</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a project. I&apos;ll read its edit log and AI chat history and help you turn the
          pattern in it into a skill.
        </p>
      </div>

      {!projectId ? (
        <div className="space-y-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name…"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {projects.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : projects.data?.items.length ? (
              projects.data.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProjectId(p.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-left text-xs hover:border-input hover:bg-muted"
                >
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="shrink-0 text-muted-foreground">{p.owner?.email ?? p.userId}</span>
                </button>
              ))
            ) : (
              <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">No projects found.</p>
            )}
          </div>
        </div>
      ) : (
        <BuilderSession projectId={projectId} onChangeProject={() => setProjectId(null)} onUseAsSkill={onUseAsSkill} />
      )}
    </div>
  );
}

function BuilderSession({
  projectId,
  onChangeProject,
  onUseAsSkill,
}: {
  projectId: string;
  onChangeProject: () => void;
  onUseAsSkill: (body: string) => void;
}) {
  const project = useAdminProjectDoc(projectId);
  const chats = useAdminProjectChats(projectId);
  const [modelIndex, setModelIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const model = MODELS[modelIndex];

  if (project.isLoading || chats.isLoading) return <Skeleton className="h-64 w-full" />;
  if (project.isError || !project.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load that project.</p>;
  }

  return (
    <ChatSession
      key={projectId}
      project={project.data.project}
      threads={chats.data?.threads ?? []}
      model={model.id}
      depcutProvider={model.depcutProvider}
      modelIndex={modelIndex}
      onModelChange={setModelIndex}
      draft={draft}
      onDraftChange={setDraft}
      scrollRef={scrollRef}
      onChangeProject={onChangeProject}
      onUseAsSkill={onUseAsSkill}
    />
  );
}

function ChatSession({
  project,
  threads,
  model,
  depcutProvider,
  modelIndex,
  onModelChange,
  draft,
  onDraftChange,
  scrollRef,
  onChangeProject,
  onUseAsSkill,
}: {
  project: NonNullable<ReturnType<typeof useAdminProjectDoc>["data"]>["project"];
  threads: NonNullable<ReturnType<typeof useAdminProjectChats>["data"]>["threads"];
  model: string;
  depcutProvider: string;
  modelIndex: number;
  onModelChange: (i: number) => void;
  draft: string;
  onDraftChange: (v: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onChangeProject: () => void;
  onUseAsSkill: (body: string) => void;
}) {
  const { busy, error, messages, sendMessage } = useSkillBuilderChat({ depcutProvider, model, project, threads });
  const doc = project.doc as { editLog?: unknown[] };
  const editLogCount = Array.isArray(doc.editLog) ? doc.editLog.length : 0;

  const submit = () => {
    if (!draft.trim() || busy) return;
    sendMessage(draft);
    onDraftChange("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs">
        <span className="truncate">
          <span className="font-medium">{project.name}</span> — {editLogCount} edit log entr
          {editLogCount === 1 ? "y" : "ies"}, {threads.length} chat thread{threads.length === 1 ? "" : "s"}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onChangeProject} title="Change project">
          <X className="size-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="max-h-96 min-h-32 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ask me what pattern I see in this project, or just say &quot;draft a skill for this&quot;.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col gap-1", m.role === "user" && "items-end")}>
            <div
              className={cn(
                "ai-md max-w-[90%] rounded-xl px-2.5 py-1.5 text-[12.5px] leading-relaxed",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              <Markdown components={baseMarkdownComponents}>{m.text}</Markdown>
            </div>
            {m.role === "assistant" && (
              <Button size="sm" variant="outline" onClick={() => onUseAsSkill(extractDraft(m.text))}>
                Use as new skill
              </Button>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Thinking…
          </div>
        )}
        {error && <p className="text-[11.5px] text-destructive">{error}</p>}
      </div>

      <div className="relative rounded-xl border border-input bg-background transition-colors focus-within:border-ring">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="Ask about this project, or say “draft a skill for this”…"
          className="max-h-56 w-full resize-none overflow-y-auto bg-transparent px-3 pt-2 text-[12.5px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
        <div className="flex items-center justify-between px-1.5 pb-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
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
          <Button size="sm" disabled={!draft.trim() || busy} onClick={submit}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
