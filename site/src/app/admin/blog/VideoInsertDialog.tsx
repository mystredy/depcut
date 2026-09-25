"use client";

import { useRef, useState } from "react";
import { Link2, Loader2, Play, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddBlogContentVideo,
  useAdminContentGenerations,
  useGenerateBlogVideo,
} from "@/queries/admin";
import { cn } from "@/lib/utils";

type Tab = "url" | "upload" | "generate" | "library";

const TABS: { key: Tab; label: string; icon: typeof Link2 }[] = [
  { key: "url", label: "URL", icon: Link2 },
  { key: "upload", label: "Upload", icon: Upload },
  { key: "generate", label: "Generate", icon: Sparkles },
  { key: "library", label: "Library", icon: Play },
];

// Recognizes the handful of real YouTube URL shapes (watch, youtu.be short
// link, /embed/, /shorts/) and pulls out just the video id — null for
// anything else, including a non-YouTube URL. Matches the same id shape
// the public page's embed check (BlogPostPage) uses.
function extractYoutubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return parsed.pathname.slice(1) || null;
  if (host !== "youtube.com" && host !== "m.youtube.com") return null;
  if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
  if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] ?? null;
  if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] ?? null;
  return null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // null for a brand-new, unsaved post — Upload/Generate/Library all need a
  // real post id to store against, so they stay disabled until then; URL
  // (a YouTube link) never needs one, since it's just a plain insert with
  // nothing of its own to store.
  postId: string | null;
  onInsert: (url: string, label: string) => void;
};

// The blog editor's "Insert video" toolbar button opens this instead of a
// bare window.prompt — same four-tab shape as ImageInsertDialog. URL is
// YouTube-only (its link is what the public page's embed check recognizes);
// Upload/Generate/Library all produce a self-hosted video file, durably
// stored through api/admin/blog/[id]/videos, whose own url the public
// page's embed check also recognizes (see BlogPostPage).
export function VideoInsertDialog({ open, onOpenChange, postId, onInsert }: Props) {
  const [tab, setTab] = useState<Tab>("url");
  const [urlValue, setUrlValue] = useState("https://");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addVideo = useAddBlogContentVideo();
  const generateVideo = useGenerateBlogVideo();
  const library = useAdminContentGenerations("video");

  const needsSavedPost = !postId;
  const busy = addVideo.isPending || generateVideo.isPending;

  const changeTab = (next: Tab) => {
    setTab(next);
    setError(null);
  };

  const finishInsert = (url: string, label: string) => {
    onInsert(url, label);
    onOpenChange(false);
    setUrlValue("https://");
    setPrompt("");
    setError(null);
  };

  const handleUrlSubmit = () => {
    const raw = urlValue.trim();
    if (!raw || raw === "https://") return;
    const videoId = extractYoutubeId(raw);
    if (!videoId) {
      setError("That doesn't look like a YouTube video URL.");
      return;
    }
    finishInsert(`https://www.youtube.com/watch?v=${videoId}`, "▶ Watch on YouTube");
  };

  const handleFile = async (file: File) => {
    if (!postId) return;
    setError(null);
    try {
      const result = await addVideo.mutateAsync({ id: postId, input: { file, kind: "file" } });
      finishInsert(result.url, "▶ Watch video");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that video.");
    }
  };

  const handleGenerate = async () => {
    if (!postId || !prompt.trim()) return;
    setError(null);
    try {
      const gen = await generateVideo.mutateAsync({ prompt: prompt.trim() });
      const out = gen.outputs.find((o) => o.dataBase64);
      if (!out?.dataBase64) throw new Error("The model returned no video.");
      const result = await addVideo.mutateAsync({
        id: postId,
        input: { contentType: out.contentType || "video/mp4", dataBase64: out.dataBase64, kind: "base64" },
      });
      finishInsert(result.url, "▶ Watch video");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate that video.");
    }
  };

  const handleLibraryPick = async (sourceUrl: string) => {
    if (!postId) return;
    setError(null);
    try {
      const result = await addVideo.mutateAsync({ id: postId, input: { kind: "url", url: sourceUrl } });
      finishInsert(result.url, "▶ Watch video");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that video.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert video</DialogTitle>
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
              placeholder="https://www.youtube.com/watch?v=…"
            />
            <Button className="w-full" onClick={handleUrlSubmit}>
              Insert
            </Button>
          </div>
        )}

        {tab === "upload" &&
          (needsSavedPost ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Save this post once to upload a video.
            </p>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm"
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
                {addVideo.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Choose a file
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">MP4 or WebM, up to 50MB.</p>
            </div>
          ))}

        {tab === "generate" &&
          (needsSavedPost ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Save this post once to generate a video.
            </p>
          ) : (
            <div className="space-y-3">
              <Textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the video…"
                rows={3}
              />
              <Button className="w-full" disabled={busy || !prompt.trim()} onClick={() => void handleGenerate()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
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
            <p className="py-6 text-center text-sm text-muted-foreground">No generated videos yet.</p>
          ) : (
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
              {library.data.items
                .filter((item): item is typeof item & { outputUrl: string } => Boolean(item.outputUrl))
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLibraryPick(item.outputUrl)}
                    title={item.prompt}
                    className="relative aspect-video overflow-hidden rounded-md border bg-muted hover:ring-2 hover:ring-ring disabled:opacity-50"
                  >
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 thumbnail, not a Next-optimizable local asset
                      <img src={item.posterUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Play className="absolute inset-0 m-auto size-5 text-muted-foreground" />
                    )}
                  </button>
                ))}
            </div>
          ))}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
