"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";

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
  type AdminLegalPage,
  useAdminLegalPages,
  useUpdateLegalPage,
} from "@/queries/admin";

const ROUTES: Record<string, string> = { privacy: "/privacy", terms: "/terms" };

export default function AdminPagesPage() {
  const pages = useAdminLegalPages();
  const [editing, setEditing] = useState<AdminLegalPage | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Pages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the content that renders on the public legal pages.
        </p>
      </div>

      {pages.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : pages.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load pages. Try again.</p>
      ) : (
        <div className="space-y-3">
          {pages.data?.pages.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ROUTES[p.slug] ?? `/${p.slug}`} · updated {new Date(p.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                <Pencil className="size-3.5" data-icon="inline-start" /> Edit
              </Button>
            </div>
          ))}
        </div>
      )}

      <PageDialog page={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function PageDialog({ page, onClose }: { page: AdminLegalPage | null; onClose: () => void }) {
  const update = useUpdateLegalPage();
  const [title, setTitle] = useState(page?.title ?? "");
  const [contentMarkdown, setContentMarkdown] = useState(page?.contentMarkdown ?? "");

  const key = page?.id ?? "closed";
  const [openKey, setOpenKey] = useState(key);
  if (key !== openKey) {
    setOpenKey(key);
    setTitle(page?.title ?? "");
    setContentMarkdown(page?.contentMarkdown ?? "");
  }

  const save = () => {
    if (!page || !title.trim() || !contentMarkdown.trim()) return;
    update.mutate(
      { contentMarkdown, id: page.id, title: title.trim() },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open={page !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit {page?.title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Content (Markdown)</Label>
            <Textarea
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              rows={18}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || !contentMarkdown.trim() || update.isPending} onClick={save}>
            {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
