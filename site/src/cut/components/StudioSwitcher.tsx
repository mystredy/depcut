"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";

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
import { useCutBase } from "@/cut/lib/nav";
import { cn } from "@/lib/utils";
import { useStudios, useCreateStudio } from "@/queries/studio";

// Shown at the top of every studio: which one you're looking at, and quick
// links to the others this account owns or manages — the Facebook
// profile/Page switcher equivalent, YouTube-channel-switcher style. No
// studio is privileged as "the" default; a signed-in account can own zero,
// one, or many.
export function StudioSwitcher({ currentUsername }: { currentUsername: string | null }) {
  const base = useCutBase();
  const studios = useStudios();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(studios.data?.spaces ?? []).map((studio) => (
        <Link
          key={studio.id}
          href={`${base}/studio/${studio.username}`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            currentUsername === studio.username
              ? "border-ink bg-ink text-white"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {studio.name}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3" />
        New studio
      </button>

      {creating && <CreateStudioDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

// Also used by the Space hub page (no studio to switch between yet, but
// still needs "create your first one").
export function CreateStudioDialog({ onClose }: { onClose: () => void }) {
  const base = useCutBase();
  const create = useCreateStudio();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");

  const submit = () => {
    if (!name.trim() || !username.trim()) return;
    create.mutate(
      { name: name.trim(), username: username.trim() },
      {
        onSuccess: ({ studio }) => {
          window.location.href = `${base}/studio/${studio.username}`;
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a studio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Studio name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Viral Kings" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="viralkings"
            />
            <p className="text-[11px] text-muted-foreground">
              3-20 characters: letters, numbers, underscores, starting with a letter.
            </p>
          </div>
          {create.isError && <p className="text-xs text-destructive">{(create.error as Error).message}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || !username.trim() || create.isPending} onClick={submit}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
