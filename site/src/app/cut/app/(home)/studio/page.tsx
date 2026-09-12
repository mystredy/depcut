"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Video } from "lucide-react";

import { UserAvatar } from "@/cut/components/UserAvatar";
import { useCutBase } from "@/cut/lib/nav";
import { useStudios } from "@/queries/studio";
import { CreateStudioDialog } from "@/cut/components/StudioSwitcher";

// The entry point into Space: no studio is privileged as "yours" by
// default — YouTube-channel style, an account owns or manages zero, one,
// or many. Exactly one studio skips straight to it; otherwise this is a
// picker (2+) or a "create your first one" prompt (0).
export default function StudioHubPage() {
  const base = useCutBase();
  const router = useRouter();
  const studios = useStudios();
  const [creating, setCreating] = useState(false);

  const list = studios.data?.spaces ?? [];
  useEffect(() => {
    if (list.length === 1) router.replace(`${base}/studio/${list[0].username}`);
  }, [list, base, router]);

  if (studios.isLoading || list.length === 1) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-muted">
            <Video className="size-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Create your first studio</h1>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              A studio is where your drops live — nothing is posted anywhere until you create one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
          >
            <Plus className="size-4" />
            New studio
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-lg font-semibold tracking-tight">Your studios</h1>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map((studio) => (
              <a
                key={studio.id}
                href={`${base}/studio/${studio.username}`}
                className="flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors hover:border-ring hover:bg-muted/40"
              >
                <UserAvatar name={studio.name} image={null} className="size-11 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{studio.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{studio.username} · {studio.role}
                  </p>
                </div>
              </a>
            ))}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-3 rounded-2xl border border-dashed p-4 text-left text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-dashed">
                <Plus className="size-4" />
              </span>
              <span className="text-sm font-medium">New studio</span>
            </button>
          </div>
        </>
      )}

      {creating && <CreateStudioDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
