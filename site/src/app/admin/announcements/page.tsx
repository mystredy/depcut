"use client";

import { useState } from "react";
import { Eye, Loader2, Pencil, Pin, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type AdminAnnouncement,
  type AnnouncementTargetType,
  useAdminAnnouncements,
  useAdminUsers,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from "@/queries/admin";

const TEMPLATES: Record<string, { headline: string; priority: "Info" | "Warning" | "Critical"; isPinned: boolean }> = {
  digest: {
    headline: "Your weekly creator digest is ready — see how your submissions performed this week.",
    isPinned: false,
    priority: "Info",
  },
  guidelines: {
    headline: "A reminder to review our updated quality guidelines before submitting new work.",
    isPinned: true,
    priority: "Critical",
  },
  maintenance: {
    headline: "The platform will be undergoing scheduled maintenance. Some features may be temporarily unavailable.",
    isPinned: true,
    priority: "Warning",
  },
  payout: {
    headline: "This cycle's payouts have been processed. Check your withdrawal history for details.",
    isPinned: false,
    priority: "Info",
  },
};

const PRIORITY_STYLES: Record<string, string> = {
  Critical: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  Info: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  Warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
};

export default function AdminAnnouncementsPage() {
  const announcements = useAdminAnnouncements();
  const users = useAdminUsers("");
  const create = useCreateAnnouncement();
  const update = useUpdateAnnouncement();
  const del = useDeleteAnnouncement();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [priority, setPriority] = useState<"Info" | "Warning" | "Critical">("Info");
  const [isPinned, setIsPinned] = useState(false);
  const [targetType, setTargetType] = useState<AnnouncementTargetType>("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = (key: string) => {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    setHeadline(tpl.headline);
    setPriority(tpl.priority);
    setIsPinned(tpl.isPinned);
  };

  const matchingUsers =
    users.data?.users.filter((u) => {
      if (targetType === "all") return true;
      if (targetType === "super_users") return u.superUser;
      return u.id === targetUserId;
    }) ?? [];

  const resetForm = () => {
    setEditingId(null);
    setHeadline("");
    setPriority("Info");
    setIsPinned(false);
    setTargetType("all");
    setTargetUserId("");
    setScheduledAt("");
  };

  const startEdit = (ann: AdminAnnouncement) => {
    setEditingId(ann.id);
    setHeadline(ann.headline);
    setPriority(ann.priority);
    setIsPinned(ann.isPinned);
    setTargetType(ann.targetType);
    setTargetUserId(ann.targetUserId ?? "");
    setScheduledAt(ann.scheduledAt ? ann.scheduledAt.slice(0, 16) : "");
  };

  const submit = () => {
    if (!headline.trim()) {
      setError("Headline cannot be empty.");
      return;
    }
    if (targetType === "specific_user" && !targetUserId) {
      setError("Pick a creator to target.");
      return;
    }
    setError(null);

    const payload = {
      headline: headline.trim(),
      isPinned,
      priority,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      targetType,
      targetUserId: targetType === "specific_user" ? targetUserId : undefined,
    };

    if (editingId) {
      update.mutate({ id: editingId, ...payload }, { onSuccess: resetForm });
    } else {
      create.mutate(payload, { onSuccess: resetForm });
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Announcements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compose and target broadcast announcements. An instant broadcast lands in every matching
          user's notification bell right away; a scheduled one is stored only — nothing delivers it
          automatically yet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-2xl border bg-card p-5 lg:col-span-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {editingId ? "Edit announcement" : "Configure new broadcast"}
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Templates</Label>
            <select
              onChange={(e) => applyTemplate(e.target.value)}
              defaultValue=""
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">-- Select a starter template --</option>
              <option value="maintenance">Platform Maintenance (Warning, Pinned)</option>
              <option value="payout">Payout Cycle Processed (Info)</option>
              <option value="guidelines">Quality Guidelines Reminder (Critical, Pinned)</option>
              <option value="digest">Weekly Creator Digest (Info)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Broadcast Message</Label>
            <Textarea
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              rows={4}
              placeholder="Type the announcement text here…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Pin Banner</Label>
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                  isPinned ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                )}
              >
                <Pin className="size-3.5" /> {isPinned ? "Pinned" : "Pin to Top"}
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "Info" | "Warning" | "Critical")}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              >
                <option value="Info">Info</option>
                <option value="Warning">Warning</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Target Audience</Label>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <Eye className="size-3" /> View list ({matchingUsers.length})
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "all" as const, label: "All Users" },
                  { id: "super_users" as const, label: "Super Users" },
                  { id: "specific_user" as const, label: "Specific User" },
                ]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTargetType(opt.id)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
                    targetType === opt.id
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {targetType === "specific_user" && (
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">Select a user…</option>
                {users.data?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || u.name} ({u.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Schedule (leave blank to publish instantly)</Label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
            <Button className="flex-1" disabled={pending} onClick={submit}>
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              ) : (
                <Send className="size-3.5" data-icon="inline-start" />
              )}
              {editingId ? "Update Broadcast" : "Publish Broadcast"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Broadcast Archive ({announcements.data?.announcements.length ?? 0})
          </p>

          {announcements.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : announcements.isError ? (
            <p className="text-sm text-destructive">Couldn&apos;t load announcements. Try again.</p>
          ) : announcements.data?.announcements.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              No announcements published yet.
            </div>
          ) : (
            <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
              {announcements.data?.announcements.map((ann) => (
                <div key={ann.id} className="space-y-2 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase", PRIORITY_STYLES[ann.priority])}>
                        {ann.priority}
                      </span>
                      {ann.isPinned && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <Pin className="size-2.5" /> Pinned
                        </span>
                      )}
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                        {ann.status}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon-sm" variant="ghost" onClick={() => startEdit(ann)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => del.mutate(ann.id)}>
                        <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed">{ann.headline}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 font-mono text-[10px] text-muted-foreground">
                    <span>
                      Target:{" "}
                      <span className="font-semibold text-foreground">
                        {ann.targetType === "all"
                          ? "All Users"
                          : ann.targetType === "super_users"
                            ? "Super Users"
                            : ann.targetUser?.displayName || ann.targetUser?.name || "—"}
                      </span>
                    </span>
                    <span>
                      {ann.scheduledAt ? `Scheduled: ${new Date(ann.scheduledAt).toLocaleString()}` : "Instant"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Target recipients ({matchingUsers.length})</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border p-2">
            {matchingUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 border-b py-1.5 text-xs last:border-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{u.displayName || u.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{u.email}</p>
                </div>
                {u.superUser && (
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
                    Super
                  </span>
                )}
              </div>
            ))}
            {matchingUsers.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No users match this filter.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
