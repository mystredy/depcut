"use client";

import { ImageIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useAdminContentGenerations, type AdminContentOwner } from "@/queries/admin";

function ownerLabel(owner: AdminContentOwner | null): string {
  if (!owner) return "Deleted account";
  return owner.displayName || owner.name || owner.email;
}

// Shared by the admin Content → Images and → Videos pages: same shape (a
// Flow generation of one kind, most recent first), same card layout — an
// image renders as a still, a video as its poster with a play affordance.
export function AdminContentGenerationsGrid({ kind }: { kind: "image" | "video" }) {
  const generations = useAdminContentGenerations(kind);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          AI Generated {kind === "image" ? "Images" : "Videos"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every account's Flow {kind === "image" ? "image" : "video"} generation, most recent first.
        </p>
      </div>

      {generations.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-xl" />
          ))}
        </div>
      ) : generations.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load generations. Try again.</p>
      ) : generations.data?.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No {kind === "image" ? "images" : "videos"} yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {generations.data?.items.map((g) => (
            <div key={g.id} className="space-y-1.5">
              <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted/30">
                {kind === "video" && g.outputUrl ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption -- an admin content preview, not authored media
                  <video
                    src={g.outputUrl}
                    poster={g.posterUrl ?? undefined}
                    controls
                    className="h-full w-full object-cover"
                  />
                ) : g.outputUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- an ever-changing presigned R2 URL, not a static asset
                  <img src={g.outputUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <ImageIcon className="size-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium" title={g.prompt}>
                  {g.prompt}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {ownerLabel(g.owner)} · {g.model} · {new Date(g.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
