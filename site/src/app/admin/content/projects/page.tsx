"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Clapperboard, Copy, Loader2, Trash2, X } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useAdminCloneProject,
  useAdminContentProjects,
  useAdminDeleteProject,
  type AdminContentOwner,
  type AdminContentProject,
} from "@/queries/admin";

function ownerLabel(owner: AdminContentOwner | null): string {
  if (!owner) return "Deleted account";
  return owner.displayName || owner.name || owner.email;
}

export default function AdminContentProjectsPage() {
  const projects = useAdminContentProjects();
  const clone = useAdminCloneProject();
  const del = useAdminDeleteProject();
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: true; projectId: string } | { ok: false; message: string } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminContentProject | null>(null);

  const cloneProject = (id: string) => {
    if (cloningId) return;
    setCloningId(id);
    setResult(null);
    clone.mutate(id, {
      onSuccess: ({ newProjectId }) => {
        setResult(newProjectId ? { ok: true, projectId: newProjectId } : { ok: false, message: "Clone finished, but no project id came back." });
      },
      onError: (e) => setResult({ ok: false, message: e instanceof Error ? e.message : "Could not clone the project." }),
      onSettled: () => setCloningId(null),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Video Editor Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every account's Cut project, most recently edited first. Right-click a project for more.
        </p>
      </div>

      {result && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border p-3 text-sm",
            result.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {result.ok ? (
            <span className="flex items-center gap-1.5">
              <Check className="size-4 shrink-0" /> Cloned into your account.{" "}
              <Link href={`/app/p/${result.projectId}`} target="_blank" className="font-medium underline underline-offset-2">
                Open it
              </Link>
            </span>
          ) : (
            <span>{result.message}</span>
          )}
          <button type="button" onClick={() => setResult(null)} className="shrink-0 text-current opacity-70 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      {projects.isLoading ? (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />
          ))}
        </div>
      ) : projects.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load projects. Try again.</p>
      ) : projects.data?.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {projects.data?.items.map((p) => (
            <ContextMenu key={p.id}>
              <ContextMenuTrigger className="space-y-1.5 outline-none">
                <div className="relative aspect-[9/16] overflow-hidden rounded-xl border bg-muted/30">
                  {!p.previewUrl ? (
                    <div className="grid h-full w-full place-items-center">
                      <Clapperboard className="size-6 text-muted-foreground" />
                    </div>
                  ) : p.previewIsImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a signed media-worker URL, not a static asset
                    <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line jsx-a11y/media-has-caption -- a silent hover-preview thumbnail, not authored media
                    <video
                      src={`${p.previewUrl}#t=${p.previewStart}`}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span
                    className={cn(
                      "absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]",
                      p.hasExported ? "bg-emerald-600/80" : "bg-black/40",
                    )}
                  >
                    {p.hasExported ? "Exported" : "Not exported"}
                  </span>
                  {cloningId === p.id && (
                    <div className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/50 text-white">
                      <Loader2 className="size-3.5 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{p.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {ownerLabel(p.owner)} · {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem disabled={cloningId === p.id} onClick={() => cloneProject(p.id)}>
                  <Copy /> Clone to my account
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={() => setDeleteTarget(p)}>
                  <Trash2 /> Delete project
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>, owned by{" "}
              {deleteTarget ? ownerLabel(deleteTarget.owner) : ""}, and all its media will be permanently
              deleted. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {del.isError && (
            <p className="text-sm text-destructive">
              {del.error instanceof Error ? del.error.message : "Could not delete the project."}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              }}
            >
              {del.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
