"use client";

import { useState } from "react";
import {
  ArrowRight,
  AtSign,
  Camera,
  Film,
  Ghost,
  Hash,
  Link2,
  Loader2,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  Share2,
  Video,
  Workflow as WorkflowIcon,
  type LucideIcon,
} from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  type AdminSocialWorkflow,
  type AdminSocialWorkflowConnection,
  useAdminSocialConnections,
  useAdminSocialWorkflows,
  useCreateSocialWorkflow,
  useDeleteSocialWorkflow,
  useUpdateSocialWorkflow,
} from "@/queries/admin";

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  facebook: MessageCircle,
  instagram: Camera,
  snapchat: Ghost,
  telegram: Send,
  threads: AtSign,
  tiktok: Share2,
  x: Hash,
  youtube: Video,
  youtube_shorts: Film,
};

type Filter = "all" | "active" | "inactive";

// Pairs a linked source connection with a destination connection to
// repurpose content between platforms. No real publish pipeline reads
// these yet — Auto Publish is a stored preference, not live automation.
export default function AdminSocialWorkflowsPage() {
  const workflows = useAdminSocialWorkflows();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);

  const all = workflows.data?.workflows ?? [];
  const filtered = all.filter((w) => {
    if (filter === "active" && w.status !== "Active") return false;
    if (filter === "inactive" && w.status !== "Inactive") return false;
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <WorkflowIcon className="size-5 text-muted-foreground" /> Workflows
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Repurpose content from one linked connection to another. No publish pipeline runs
            these yet — Auto Publish is stored for when that&apos;s built.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-3.5" data-icon="inline-start" /> Create Another Workflow
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 focus-within:border-ring">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workflows</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {workflows.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : workflows.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load workflows. Try again.</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No workflows yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => (
            <WorkflowCard key={w.id} workflow={w} />
          ))}
        </div>
      )}

      <CreateWorkflowDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function ConnectionPill({ connection }: { connection: AdminSocialWorkflowConnection }) {
  const Icon = PLATFORM_ICONS[connection.platform] ?? Link2;
  return (
    <div
      className="flex size-9 items-center justify-center rounded-lg border bg-muted"
      title={`${connection.accountName}${connection.accountHandle ? ` (${connection.accountHandle})` : ""}`}
    >
      <Icon className="size-4" />
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: AdminSocialWorkflow }) {
  const update = useUpdateSocialWorkflow();
  const del = useDeleteSocialWorkflow();
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{workflow.name}</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreVertical className="size-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border bg-popover p-1 text-xs shadow-md">
              <button
                type="button"
                disabled={del.isPending}
                onClick={() => {
                  del.mutate(workflow.id);
                  setMenuOpen(false);
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ConnectionPill connection={workflow.sourceConnection} />
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <ConnectionPill connection={workflow.destinationConnection} />
        </div>
        <button
          type="button"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: workflow.id, status: workflow.status === "Active" ? "Inactive" : "Active" })}
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
            workflow.status === "Active"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {workflow.status}
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2">
        <span className="text-xs font-medium">Auto Publish</span>
        <Switch
          checked={workflow.autoPublish}
          onCheckedChange={(v) => update.mutate({ autoPublish: v, id: workflow.id })}
          aria-label="Auto publish"
        />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-primary hover:underline"
      >
        {expanded ? "Hide details" : "View workflow"}
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3 text-xs">
          <div>
            <p className="text-muted-foreground">Source</p>
            <p className="font-medium">
              {workflow.sourceConnection.accountName}
              {workflow.sourceConnection.accountHandle ? ` · ${workflow.sourceConnection.accountHandle}` : ""}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Destination</p>
            <p className="font-medium">
              {workflow.destinationConnection.accountName}
              {workflow.destinationConnection.accountHandle
                ? ` · ${workflow.destinationConnection.accountHandle}`
                : ""}
            </p>
          </div>
          <p className="col-span-2 text-muted-foreground">
            No run history yet — nothing publishes through this workflow automatically.
          </p>
        </div>
      )}
    </div>
  );
}

function CreateWorkflowDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const connections = useAdminSocialConnections();
  const create = useCreateSocialWorkflow();
  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");

  const sources = connections.data?.connections.filter((c) => c.role === "source") ?? [];
  const destinations = connections.data?.connections.filter((c) => c.role === "destination") ?? [];

  const submit = () => {
    if (!name.trim() || !sourceId || !destinationId) return;
    create.mutate(
      { destinationConnectionId: destinationId, name: name.trim(), sourceConnectionId: sourceId },
      {
        onSuccess: () => {
          setName("");
          setSourceId("");
          setDestinationId("");
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Another Workflow</DialogTitle>
        </DialogHeader>
        {sources.length === 0 || destinations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add at least one source and one destination connection under Social Media →
            Connections first.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Workflow name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shorts to X" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source connection</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Destination connection</Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a destination" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || !sourceId || !destinationId || create.isPending}
            onClick={submit}
          >
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Create Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
