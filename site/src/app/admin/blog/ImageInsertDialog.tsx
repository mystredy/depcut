"use client";

import { useRef, useState } from "react";
import { Link2, Loader2, Sparkles, Upload, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddBlogContentImage,
  useAdminContentGenerations,
  useGenerateBlogImage,
} from "@/queries/admin";
import { cn } from "@/lib/utils";

type Tab = "url" | "upload" | "generate" | "library";

const TABS: { key: Tab; label: string; icon: typeof Link2 }[] = [
  { key: "url", label: "URL", icon: Link2 },
  { key: "upload", label: "Upload", icon: Upload },
  { key: "generate", label: "Generate", icon: Sparkles },
  { key: "library", label: "Library", icon: ImageIcon },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // null for a brand-new, unsaved post — Upload/Generate/Library all need a
  // real post id to store against, so they stay disabled until then; URL
  // never needs one, since it's just a plain insert with no storage of its
  // own.
  postId: string | null;
  onInsert: (url: string) => void;
};

// The blog editor's "Insert image" toolbar button opens this instead of a
// bare window.prompt — one popover, four ways to end up with a URL to
// insert, all funneled through the same durable-storage route
// (api/admin/blog/[id]/images) except URL, which just inserts what was
// typed.
export function ImageInsertDialog({ open, onOpenChange, postId, onInsert }: Props) {
  const [tab, setTab] = useState<Tab>("url");
  const [urlValue, setUrlValue] = useState("https://");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addImage = useAddBlogContentImage();
  const generateImage = useGenerateBlogImage();
  const library = useAdminContentGenerations("image");

  const needsSavedPost = !postId;
  const busy = addImage.isPending || generateImage.isPending;

  const changeTab = (next: Tab) => {
    setTab(next);
    setError(null);
  };

  const finishInsert = (url: string) => {
    onInsert(url);
    onOpenChange(false);
    setUrlValue("https://");
    setPrompt("");
    setError(null);
  };

  const handleUrlSubmit = () => {
    const url = urlValue.trim();
    if (!url || url === "https://") return;
    finishInsert(url);
  };

  const handleFile = async (file: File) => {
    if (!postId) return;
    setError(null);
    try {
      const result = await addImage.mutateAsync({ id: postId, input: { file, kind: "file" } });
      finishInsert(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that image.");
    }
  };

  const handleGenerate = async () => {
    if (!postId || !prompt.trim()) return;
    setError(null);
    try {
      const gen = await generateImage.mutateAsync({ prompt: prompt.trim() });
      const out = gen.outputs.find((o) => o.dataBase64);
      if (!out?.dataBase64) throw new Error("The model returned no image.");
      const result = await addImage.mutateAsync({
        id: postId,
        input: { contentType: out.contentType || "image/png", dataBase64: out.dataBase64, kind: "base64" },
      });
      finishInsert(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate that image.");
    }
  };

  const handleLibraryPick = async (sourceUrl: string) => {
    if (!postId) return;
    setError(null);
    try {
      const result = await addImage.mutateAsync({ id: postId, input: { kind: "url", url: sourceUrl } });
      finishInsert(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that image.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "url" && (
          <div className="space-y-3">
            <Input
              autoFocus
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              placeholder="https://"
            />
            <Button className="w-full" onClick={handleUrlSubmit}>
              Insert
            </Button>
          </div>
        )}

        {tab === "upload" &&
          (needsSavedPost ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Save this post once to upload an image.
            </p>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/webp,image/jpeg,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleFile(file);
                }}
              />
              <Button
                className="w-full"
                variant="outline"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {addImage.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Choose a file
              </Button>
            </div>
          ))}

        {tab === "generate" &&
          (needsSavedPost ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Save this post once to generate an image.
            </p>
          ) : (
            <div className="space-y-3">
              <Textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image…"
                rows={3}
              />
              <Button className="w-full" disabled={busy || !prompt.trim()} onClick={() => void handleGenerate()}>
                {generateImage.isPending || addImage.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generate
              </Button>
            </div>
          ))}

        {tab === "library" &&
          (needsSavedPost ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Save this post once to use the library.
            </p>
          ) : library.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : !library.data?.items.some((item) => item.outputUrl) ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No generated images yet.</p>
          ) : (
            <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto">
              {library.data.items
                .filter((item): item is typeof item & { outputUrl: string } => Boolean(item.outputUrl))
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLibraryPick(item.outputUrl)}
                    title={item.prompt}
                    className="aspect-square overflow-hidden rounded-md border hover:ring-2 hover:ring-ring disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a presigned R2 thumbnail, not a Next-optimizable local asset */}
                    <img src={item.outputUrl} alt="" className="size-full object-cover" />
                  </button>
                ))}
            </div>
          ))}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
