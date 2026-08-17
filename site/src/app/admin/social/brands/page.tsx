"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  AtSign,
  Camera,
  Film,
  Ghost,
  Hash,
  ImageUp,
  Link2,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Share2,
  Trash2,
  Video,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AdminBrand,
  useAdminBrands,
  useAdminSocialConnections,
  useCreateBrand,
  useDeleteBrand,
  useUpdateSocialConnection,
  useUploadBrandLogo,
} from "@/queries/admin";

const LOGO_OUTPUT = 256;
const LOGO_TYPE = "image/webp";

// Downscales/crops-to-square client-side before upload, same idea as the
// account avatar flow but without the interactive crop UI — a brand logo is
// small and square-ish source material almost always fits fine centered.
async function toSquareLogo(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = LOGO_OUTPUT;
    canvas.height = LOGO_OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't prepare that image.");
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      LOGO_OUTPUT,
      LOGO_OUTPUT
    );
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, LOGO_TYPE, 0.9));
    if (!blob) throw new Error("Couldn't prepare that image.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

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

// Groups linked SocialConnections under a named brand. Posting one update
// to a brand and having it fan out to every connection in it is a planned
// feature, not built yet — this page only manages the grouping.
export default function AdminBrandsPage() {
  const brands = useAdminBrands();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Brand Suite</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Group linked connections under a brand. Posting to a brand and fanning it out to every
            connection in it is planned, not wired up yet.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-3.5" data-icon="inline-start" /> Create Brand
        </Button>
      </div>

      {brands.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : brands.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load brands. Try again.</p>
      ) : brands.data?.brands.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No brands yet.
        </div>
      ) : (
        <div className="space-y-3">
          {brands.data?.brands.map((b) => (
            <BrandCard key={b.id} brand={b} />
          ))}
        </div>
      )}

      <CreateBrandDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function BrandCard({ brand }: { brand: AdminBrand }) {
  const del = useDeleteBrand();
  const [managing, setManaging] = useState(false);

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {brand.hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded brand logo, served from our own API
            <img
              src={`/api/admin/brands/${brand.id}/logo?v=${encodeURIComponent(brand.updatedAt)}`}
              alt={brand.name}
              className="size-10 shrink-0 rounded-full border object-cover"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground">
              {brand.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{brand.name}</p>
            <p className="text-xs text-muted-foreground">@{brand.username}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={del.isPending}
          onClick={() => del.mutate(brand.id)}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Delete brand"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {brand.connections.length === 0 ? (
          <p className="text-xs text-muted-foreground">No connections assigned yet.</p>
        ) : (
          brand.connections.map((c) => {
            const Icon = PLATFORM_ICONS[c.platform] ?? Link2;
            return (
              <div
                key={c.id}
                className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pr-2.5 pl-1.5 text-[11px]"
                title={c.accountHandle ?? undefined}
              >
                <Icon className="size-3" />
                {c.accountName}
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => setManaging((v) => !v)}
        className="text-xs text-primary hover:underline"
      >
        {managing ? "Done" : "Manage connections"}
      </button>

      {managing && <ManageConnections brandId={brand.id} />}
    </div>
  );
}

function ManageConnections({ brandId }: { brandId: string }) {
  const connections = useAdminSocialConnections();
  const update = useUpdateSocialConnection();

  if (connections.isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border bg-muted/20 p-2">
      {connections.data?.connections.map((c) => {
        const Icon = PLATFORM_ICONS[c.platform] ?? Link2;
        const inThisBrand = c.brandId === brandId;
        return (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/60"
          >
            <input
              type="checkbox"
              checked={inThisBrand}
              disabled={update.isPending}
              onChange={(e) =>
                update.mutate({ brandId: e.target.checked ? brandId : null, id: c.id })
              }
            />
            <Icon className="size-3.5 shrink-0" />
            <span className="flex-1 truncate">{c.accountName}</span>
            {c.brandId && !inThisBrand && (
              <span className="text-[10px] text-muted-foreground">in another brand</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function CreateBrandDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateBrand();
  const uploadLogo = useUploadBrandLogo();
  const updateConnection = useUpdateSocialConnection();
  const connections = useAdminSocialConnections();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const unbranded = connections.data?.connections.filter((c) => !c.brandId) ?? [];

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const reset = () => {
    setName("");
    setUsername("");
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setLogoFile(null);
    setSelectedIds([]);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const submitting = create.isPending || uploadLogo.isPending || updateConnection.isPending;

  const submit = async () => {
    if (!name.trim() || !username.trim()) return;
    setError(null);
    create.mutate(
      { name: name.trim(), username: username.trim() },
      {
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Couldn't create brand.");
        },
        onSuccess: async (res) => {
          await Promise.all(
            selectedIds.map((id) => updateConnection.mutateAsync({ brandId: res.brand.id, id }))
          );

          if (!logoFile) {
            close();
            return;
          }
          try {
            const blob = await toSquareLogo(logoFile);
            uploadLogo.mutate(
              { blob, id: res.brand.id },
              { onError: () => setError("Brand created, but the logo upload failed."), onSuccess: close }
            );
          } catch {
            setError("Brand created, but that image couldn't be processed.");
          }
        },
      }
    );
  };

  const canSubmit = name.trim() && username.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Brand</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Virals" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Username</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/^@+/, ""))}
                placeholder="virals"
                className="pl-6"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Logo</Label>
            <div className="flex items-center gap-3">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a stored image
                <img
                  src={logoPreview}
                  alt="logo preview"
                  className="size-12 shrink-0 rounded-full border object-cover"
                />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground">
                  <ImageUp className="size-4" />
                </div>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  pickLogo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                {logoPreview ? "Replace" : "Upload logo"}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Connections</Label>
            {connections.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : connections.isError ? (
              <p className="text-xs text-destructive">Couldn&apos;t load connections.</p>
            ) : unbranded.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {connections.data?.connections.length ? (
                  "No unassigned connections — every connection already belongs to a brand."
                ) : (
                  <>
                    No connections yet —{" "}
                    <Link href="/admin/social/connections" className="text-primary hover:underline">
                      add one
                    </Link>{" "}
                    first.
                  </>
                )}
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border bg-muted/20 p-2">
                {unbranded.map((c) => {
                  const Icon = PLATFORM_ICONS[c.platform] ?? Link2;
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                      <Icon className="size-3.5 shrink-0" />
                      <span className="flex-1 truncate">{c.accountName}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || submitting} onClick={() => void submit()}>
            {submitting ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Create Brand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
