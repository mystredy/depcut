"use client";

import { Clapperboard } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useAdminContentProjects, type AdminContentOwner } from "@/queries/admin";

function ownerLabel(owner: AdminContentOwner | null): string {
  if (!owner) return "Deleted account";
  return owner.displayName || owner.name || owner.email;
}

export default function AdminContentProjectsPage() {
  const projects = useAdminContentProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Video Editor Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every account's Cut project, most recently edited first.
        </p>
      </div>

      {projects.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-xl" />
          ))}
        </div>
      ) : projects.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load projects. Try again.</p>
      ) : projects.data?.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.data?.items.map((p) => (
            <div key={p.id} className="space-y-1.5">
              <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted/30">
                {p.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- an ever-changing presigned R2 URL, not a static asset
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <Clapperboard className="size-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{p.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {ownerLabel(p.owner)} · {new Date(p.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
