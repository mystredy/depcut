"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

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
import {
  type AdminChatTemplate,
  useAdminChatTemplates,
  useCreateChatTemplate,
  useUpdateChatTemplate,
} from "@/queries/admin";

export default function AdminChatTemplatesPage() {
  const templates = useAdminChatTemplates();
  const [editing, setEditing] = useState<AdminChatTemplate | "new" | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Chat Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Named assistant presets. Not wired into the real chat assistant yet.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-3.5" data-icon="inline-start" /> New Template
        </Button>
      </div>

      {templates.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : templates.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load templates. Try again.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.data?.templates.map((t) => (
            <div key={t.id} className="space-y-3 rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{t.name}</p>
                {t.model && (
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                    {t.model}
                  </span>
                )}
              </div>
              {t.role && <p className="text-xs leading-relaxed text-muted-foreground">{t.role}</p>}
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                  <Pencil className="size-3.5" data-icon="inline-start" /> Edit
                </Button>
              </div>
            </div>
          ))}
          {templates.data?.templates.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No templates yet.
            </p>
          )}
        </div>
      )}

      <TemplateDialog target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function TemplateDialog({
  target,
  onClose,
}: {
  target: AdminChatTemplate | "new" | null;
  onClose: () => void;
}) {
  const create = useCreateChatTemplate();
  const update = useUpdateChatTemplate();
  const isNew = target === "new";
  const existing = target !== "new" ? target : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [role, setRole] = useState(existing?.role ?? "");
  const [model, setModel] = useState(existing?.model ?? "");

  // Reset local fields whenever a different template (or "new") opens.
  const key = target === "new" ? "new" : (target?.id ?? "closed");
  const [openKey, setOpenKey] = useState(key);
  if (key !== openKey) {
    setOpenKey(key);
    setName(existing?.name ?? "");
    setRole(existing?.role ?? "");
    setModel(existing?.model ?? "");
  }

  const pending = create.isPending || update.isPending;

  const save = () => {
    if (!name.trim()) return;
    if (isNew) {
      create.mutate(
        { model: model.trim() || undefined, name: name.trim(), role: role.trim() || undefined },
        { onSuccess: onClose }
      );
    } else if (existing) {
      update.mutate(
        { id: existing.id, model: model.trim(), name: name.trim(), role: role.trim() },
        { onSuccess: onClose }
      );
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "New template" : "Edit template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Legal Consultant" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="What this assistant does"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-3.5-flash" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || pending} onClick={save}>
            {pending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
