"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminAgentSkill,
  useAdminAgentSkills,
  useCreateAgentSkill,
  useDeleteAgentSkill,
  useUpdateAgentSkill,
} from "@/queries/admin";

/** The CRUD list shared by /admin/ai/skills/cut and /admin/ai/skills/blog —
 * only the agent (and, for cut, the Skill Builder alongside it) differs. */
export function AgentSkillsList({
  agent,
  initialBody,
}: {
  agent: "cut" | "blog";
  /** Prefills a new skill's body — the Skill Builder's "Use this" hands its
   * proposed text in here. */
  initialBody?: string | null;
}) {
  const skills = useAdminAgentSkills(agent);
  const del = useDeleteAgentSkill(agent);
  const [editing, setEditing] = useState<AdminAgentSkill | "new" | null>(null);

  // The Skill Builder hands a drafted skill in here — pop the create dialog
  // open with it prefilled the moment a fresh draft arrives. Same
  // reset-during-render pattern SkillDialog uses below for its own fields,
  // rather than a setState-in-effect.
  const [seenBody, setSeenBody] = useState(initialBody);
  if (initialBody !== seenBody) {
    setSeenBody(initialBody);
    if (initialBody) setEditing("new");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-3.5" data-icon="inline-start" /> New Skill
        </Button>
      </div>

      {skills.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : skills.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load skills. Try again.</p>
      ) : (
        <div className="space-y-3">
          {skills.data?.skills.map((s) => (
            <div key={s.id} className="space-y-2 rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-sm font-semibold">{s.name}</p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                    <Pencil className="size-3.5" data-icon="inline-start" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm(`Delete the "${s.name}" skill? This can't be undone.`)) del.mutate(s.id);
                    }}
                  >
                    <Trash2 className="size-3.5" data-icon="inline-start" />
                  </Button>
                </div>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
          {skills.data?.skills.length === 0 && (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No {agent} skills yet.
            </p>
          )}
        </div>
      )}

      <SkillDialog
        agent={agent}
        target={editing}
        initialBody={initialBody ?? null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function SkillDialog({
  agent,
  target,
  initialBody,
  onClose,
}: {
  agent: "cut" | "blog";
  target: AdminAgentSkill | "new" | null;
  initialBody: string | null;
  onClose: () => void;
}) {
  const create = useCreateAgentSkill();
  const update = useUpdateAgentSkill(agent);
  const isNew = target === "new";
  const existing = target !== "new" ? target : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [body, setBody] = useState(existing?.body ?? initialBody ?? "");
  const [error, setError] = useState<string | null>(null);

  // Reset local fields whenever a different skill (or "new") opens.
  const key = target === "new" ? "new" : (target?.id ?? "closed");
  const [openKey, setOpenKey] = useState(key);
  if (key !== openKey) {
    setOpenKey(key);
    setName(existing?.name ?? "");
    setBody(existing?.body ?? initialBody ?? "");
    setError(null);
  }

  const pending = create.isPending || update.isPending;
  const nameValid = /^[a-z0-9][a-z0-9-]*$/.test(name.trim());

  const save = () => {
    if (!nameValid || !body.trim()) return;
    setError(null);
    const onError = (e: unknown) => setError(e instanceof Error ? e.message : "Could not save.");
    if (isNew) {
      create.mutate({ agent, body: body.trim(), name: name.trim() }, { onError, onSuccess: onClose });
    } else if (existing) {
      update.mutate({ body: body.trim(), id: existing.id, name: name.trim() }, { onError, onSuccess: onClose });
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "New skill" : "Edit skill"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. lyric-sync-cut"
              disabled={!isNew}
            />
            {name.trim() && !nameValid && (
              <p className="text-xs text-destructive">Lowercase letters, numbers, and hyphens only.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Instructions</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What the agent should do, step by step, and when to reach for this skill."
              className="min-h-64 font-mono text-xs"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!nameValid || !body.trim() || pending} onClick={save}>
            {pending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
