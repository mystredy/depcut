"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Video as VideoIcon,
  X,
} from "lucide-react";
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
  type FlowGalleryFilters,
  type FlowSummary,
  useCreateFlow,
  useDeleteFlow,
  useDuplicateFlow,
  useFlows,
  useRenameFlow,
} from "@/queries/flows";
import { cn } from "@/lib/utils";

type GalleryFilter = "all" | "images" | "videos" | "favorites";
const GALLERY_FILTERS: { value: GalleryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
  { value: "favorites", label: "Favorites" },
];

/** Debounce the search box so every keystroke doesn't fire its own query —
 * the server does the actual filtering (see /api/flows's ?q=), so this is
 * purely about not re-querying on every letter typed. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

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

// The Flow gallery: every Flow (a server-persisted creative thread —
// see prisma/GenerationFlows.prisma) this account owns, most recently
// updated first. Opening one goes to its thread; "New Flow" starts a blank
// one and jumps straight there.
export default function ImageVideoGalleryPage() {
  const router = useRouter();
  const base = useCutBase();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const filters: FlowGalleryFilters = {
    q: debouncedSearch,
    kind: filter === "images" ? "image" : filter === "videos" ? "video" : undefined,
    favoritesOnly: filter === "favorites",
  };
  const flows = useFlows(filters);
  const create = useCreateFlow();
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const openFlow = (id: string) => router.push(`${base}/ai-suite/image-video/${id}`);

  const newFlow = () => {
    create.mutate(undefined, { onSuccess: ({ flow }) => openFlow(flow.id) });
  };

  const isFiltering = !!debouncedSearch.trim() || filter !== "all";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Flow</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Flows — every creative thread, images and videos together.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" onClick={newFlow} disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <Plus className="size-3.5" data-icon="inline-start" />
            )}
            New Flow
          </Button>
          {create.isError && <p className="text-[11px] text-destructive">Couldn&apos;t start a new Flow.</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Flows and prompts…"
            aria-label="Search Flows and prompts"
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-7 pl-8 text-[12.5px] outline-none focus-visible:border-ring"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {GALLERY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors",
                filter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {flows.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : flows.isError || !flows.data ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-destructive">Couldn&apos;t load your Flows.</p>
          <Button size="sm" variant="outline" onClick={() => flows.refetch()}>
            Try again
          </Button>
        </div>
      ) : flows.data.flows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {isFiltering ? "No Flows match this search or filter." : "No Flows yet — start one to generate an image or video."}
          </p>
          {isFiltering ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              Clear search and filters
            </Button>
          ) : (
            <Button size="sm" onClick={newFlow}>
              <Plus className="size-3.5" data-icon="inline-start" /> New Flow
            </Button>
          )}
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
  const busy = duplicate.isPending || remove.isPending;
  const menuError = duplicate.isError
    ? "Couldn't duplicate this Flow."
    : remove.isError
      ? "Couldn't delete this Flow — its media may still be uploading. Try again."
      : null;

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
        {(flow.processing || busy) && (
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
            {flow.hasFavorite && <Star className="size-3 fill-current text-amber-500" />}
          </div>
          {menuError && <p className="mt-0.5 text-[10.5px] text-destructive">{menuError}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            title="Flow options"
            aria-label="Flow options"
            disabled={busy}
            className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground disabled:pointer-events-none"
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
    if (!trimmed || trimmed === flow.name) {
      onClose();
      return;
    }
    rename.mutate({ id: flow.id, name: trimmed }, { onSuccess: onClose });
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
        {rename.isError && <p className="text-[11px] text-destructive">Couldn&apos;t rename this Flow. Try again.</p>}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={rename.isPending}>
            {rename.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
