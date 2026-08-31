"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Image as ImageIcon, Loader2, MoreVertical, Pencil, Plus, Trash2, Video as VideoIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCutBase } from "@/cut/lib/nav";
import {
  type FlowSummary,
  useCreateFlow,
  useDeleteFlow,
  useDuplicateFlow,
  useFlows,
  useRenameFlow,
} from "@/queries/flows";
import { cn } from "@/lib/utils";

/** "3h ago" / "2d ago" / "just now" — the gallery's only timestamp format. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

// The Image & Video gallery: every Flow (a server-persisted creative thread —
// see prisma/GenerationFlows.prisma) this account owns, most recently
// updated first. Opening one goes to its thread; "New Flow" starts a blank
// one and jumps straight there.
export default function ImageVideoGalleryPage() {
  const router = useRouter();
  const base = useCutBase();
  const flows = useFlows();
  const create = useCreateFlow();
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const openFlow = (id: string) => router.push(`${base}/ai-suite/image-video/${id}`);

  const newFlow = () => {
    create.mutate(undefined, { onSuccess: ({ flow }) => openFlow(flow.id) });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Image & Video</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Flows — every creative thread, images and videos together.
          </p>
        </div>
        <Button size="sm" onClick={newFlow} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          ) : (
            <Plus className="size-3.5" data-icon="inline-start" />
          )}
          New Flow
        </Button>
      </div>

      {flows.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : flows.isError || !flows.data ? (
        <p className="text-sm text-destructive">Couldn&apos;t load your Flows. Try again.</p>
      ) : flows.data.flows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">No Flows yet — start one to generate an image or video.</p>
          <Button size="sm" onClick={newFlow}>
            <Plus className="size-3.5" data-icon="inline-start" /> New Flow
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {flows.data.flows.map((f) => (
            <FlowCard
              key={f.id}
              flow={f}
              onOpen={() => openFlow(f.id)}
              onRename={() => setRenaming({ id: f.id, name: f.name })}
            />
          ))}
        </div>
      )}

      {renaming && <RenameDialog flow={renaming} onClose={() => setRenaming(null)} />}
    </div>
  );
}

function FlowCard({
  flow,
  onOpen,
  onRename,
}: {
  flow: FlowSummary;
  onOpen: () => void;
  onRename: () => void;
}) {
  const duplicate = useDuplicateFlow();
  const remove = useDeleteFlow();

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-square w-full overflow-hidden bg-muted"
      >
        {flow.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 URL, not a Next-optimizable asset
          <img src={flow.coverUrl} alt="" className="size-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            {flow.hasVideo ? <VideoIcon className="size-6" /> : <ImageIcon className="size-6" />}
          </div>
        )}
        {flow.processing && (
          <div className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/60">
            <Loader2 className="size-3.5 animate-spin text-white" />
          </div>
        )}
      </button>
      <div className="flex items-start justify-between gap-1 p-2">
        <div className="min-w-0">
          <button type="button" onClick={onOpen} className="block truncate text-left text-[12.5px] font-medium hover:underline">
            {flow.name}
          </button>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span>{relativeTime(flow.updatedAt)}</span>
            {flow.hasImage && <ImageIcon className="size-3" />}
            {flow.hasVideo && <VideoIcon className="size-3" />}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            title="Flow options"
            className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="size-3.5" data-icon="inline-start" /> Rename Flow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicate.mutate(flow.id)}>
              <Copy className="size-3.5" data-icon="inline-start" /> Duplicate Flow
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (confirm(`Delete "${flow.name}"? This can't be undone.`)) remove.mutate(flow.id);
              }}
            >
              <Trash2 className="size-3.5" data-icon="inline-start" /> Delete Flow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function RenameDialog({ flow, onClose }: { flow: { id: string; name: string }; onClose: () => void }) {
  const [name, setName] = useState(flow.name);
  const rename = useRenameFlow();

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== flow.name) rename.mutate({ id: flow.id, name: trimmed });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs space-y-3 rounded-xl border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium">Rename Flow</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") onClose();
          }}
          className={cn(
            "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
          )}
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
