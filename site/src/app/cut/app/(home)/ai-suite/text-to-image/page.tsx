"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Download, ImagePlus, Loader2 } from "lucide-react";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { ToolHistoryList } from "@/cut/components/ToolHistoryList";
import { AddRefButton, MentionTextarea, RefChips } from "@/cut/components/AssetRefs";
import { addRefOnce, type AssetRef, collectRefs, useRefCandidates } from "@/cut/lib/assetRef";
import { bytesFromBase64 } from "@/cut/lib/bytes";
import { promptAndImages } from "@/cut/lib/generate";
import { creditsUrl, NO_CREDITS_MESSAGE, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { hostedPost } from "@/cut/lib/hosted";
import { imageModel, IMAGE_MODELS, type ImageTier } from "@/cut/lib/imageModels";
import type { InlineImage } from "@/cut/lib/refMedia";
import { useToolHistory } from "@/lib/toolHistory";
import { useBlobUrl } from "@/lib/useBlobUrl";
import { cn } from "@/lib/utils";

type Aspect = "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
const ASPECTS: Aspect[] = ["16:9", "4:3", "1:1", "3:4", "9:16"];
const COUNTS = [1, 2, 3, 4] as const;

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "Sign in to Depcut to generate images.";
  if (res.status === 402) return NO_CREDITS_MESSAGE;
  const body = (await res.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
    details?: { message?: unknown } | null;
  } | null;
  const message = [body?.message, body?.error].find(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  const detail =
    typeof body?.details?.message === "string" && body.details.message.trim()
      ? body.details.message.trim()
      : null;
  if (detail && detail !== message) return message ? `${message} ${detail}` : detail;
  return message ?? fallback;
}

type GenerationResponse = { outputs: { dataBase64?: string; contentType?: string }[] };

/** What "Use again" needs to fully replay a past generation — every knob
 * plus the exact reference pictures sent, frozen as blobs so they survive
 * the originals changing or disappearing. */
type ImageGenInputs = {
  prompt: string;
  aspect: Aspect;
  tier: ImageTier;
  count: number;
  referenceImages: { name: string; blob: Blob }[];
};

/** A local file, or a picked Library/stock asset, staged as a reference —
 * never imported into a project (this page has none): an image rides to the
 * model as inline bytes fetched straight from its ref url. */
function refFromLocalFile(file: File): AssetRef {
  return {
    scope: "file",
    id: crypto.randomUUID().slice(0, 8),
    name: file.name,
    kind: file.type.startsWith("video") ? "video" : "image",
    url: URL.createObjectURL(file),
  };
}

/** A blob staged as a reference — how a generated image (fresh off the
 * composer, or pulled back out of history) becomes an attachment for the
 * next generation. */
function refFromBlob(blob: Blob, name: string): AssetRef {
  return {
    scope: "file",
    id: crypto.randomUUID().slice(0, 8),
    name,
    kind: "image",
    url: URL.createObjectURL(blob),
  };
}

/** The inline images actually sent for a generation, frozen as blobs for
 * history — generically labelled since a compose pass may reshape or merge
 * the original refs into a different set of images than were attached. */
function referenceImagesForHistory(images: InlineImage[]): { name: string; blob: Blob }[] {
  return images.map((img, i) => ({
    name: `Reference ${i + 1}`,
    blob: new Blob([bytesFromBase64(img.data)], { type: img.mimeType }),
  }));
}

// Standalone version of the Image tab's generate panel: the same hosted image
// model (kind: "image" on /api/inference/assets), minus the project — the
// render comes back as a plain downloadable file instead of landing as project
// media. References work the same way as the editor's Image tab (drop, the
// "+" menu, or an @mention), just scoped to the account Library and stock
// instead of a project's own media.
export default function TextToImagePage() {
  const signedIn = useSignedIn();
  const signedOut = signedIn === false;

  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<AssetRef[]>([]);
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [tier, setTier] = useState<ImageTier>("pro");
  const [count, setCount] = useState<(typeof COUNTS)[number]>(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [results, setResults] = useState<{ url: string; blob: Blob }[]>([]);
  const history = useToolHistory("text-to-image");

  // No project here, so only the account-wide Library and the bundled stock
  // catalog are referenceable — never a "Media" group.
  const candidates = useRefCandidates().filter((c) => c.scope === "library" || c.scope === "stock");
  const addRef = (ref: AssetRef) => setRefs((prev) => addRefOnce(prev, ref));

  useEffect(() => {
    return () => {
      for (const r of results) URL.revokeObjectURL(r.url);
    };
  }, [results]);

  const model = imageModel(tier);

  const generateOne = async (
    text: string,
    images: InlineImage[]
  ): Promise<{ url: string; blob: Blob }> => {
    const res = await hostedPost("/api/inference/assets", {
      kind: "image",
      prompt: text,
      model: model.modelId,
      ...(images.length > 0 ? { inputs: { images } } : {}),
      parameters: { aspectRatio: aspect, imageSize: "2K" },
    });
    if (!res.ok) throw new Error(await readError(res, "Image generation failed."));
    const gen = (await res.json()) as GenerationResponse;
    const out = gen.outputs.find((o) => o.dataBase64);
    if (!out?.dataBase64) throw new Error("The provider returned no image.");
    const blob = new Blob([bytesFromBase64(out.dataBase64)], {
      type: out.contentType ?? "image/png",
    });
    return { url: URL.createObjectURL(blob), blob };
  };

  const generate = async () => {
    const { text, refs: allRefs } = collectRefs(prompt.trim(), refs, candidates);
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    // Frozen once the refs resolve, reused for every history row this run
    // writes — the exact pictures sent, not just their live source.
    let referenceImages: { name: string; blob: Blob }[] = [];
    const baseInputs = (): ImageGenInputs => ({ prompt: text, aspect, tier, count, referenceImages });
    try {
      const { prompt: sent, images } = await promptAndImages("image", text, allRefs, true, Infinity);
      referenceImages = referenceImagesForHistory(images);
      const settled = await Promise.allSettled(
        Array.from({ length: count }, () => generateOne(sent, images))
      );
      const ok = settled.filter(
        (s): s is PromiseFulfilledResult<{ url: string; blob: Blob }> => s.status === "fulfilled"
      );
      const failed = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected");
      if (ok.length > 0) setResults(ok.map((s) => s.value));
      for (const s of ok) {
        history.save({
          inputs: baseInputs(),
          result: {
            blob: s.value.blob,
            filename: "text-to-image.png",
            kind: "blob",
            mimeType: s.value.blob.type || "image/png",
          },
          status: "succeeded",
          summary: text.slice(0, 80),
        });
      }
      if (failed.length > 0) {
        const first = failed[0].reason;
        const message = first instanceof Error ? first.message : "Image generation failed.";
        setError({
          text: ok.length > 0 ? `${failed.length} of ${count} failed: ${message}` : message,
          credits: message === NO_CREDITS_MESSAGE,
        });
        history.save({
          errorMessage: message,
          inputs: baseInputs(),
          status: "failed",
          summary: text.slice(0, 80),
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Image generation failed.";
      setError({ text: message, credits: message === NO_CREDITS_MESSAGE });
      history.save({
        errorMessage: message,
        inputs: baseInputs(),
        status: "failed",
        summary: text.slice(0, 80),
      });
    } finally {
      setBusy(false);
    }
  };

  const reuse = (inputs: Record<string, unknown>) => {
    if (typeof inputs.prompt === "string") setPrompt(inputs.prompt);
    if (typeof inputs.aspect === "string" && (ASPECTS as string[]).includes(inputs.aspect)) {
      setAspect(inputs.aspect as Aspect);
    }
    if (typeof inputs.tier === "string" && IMAGE_MODELS.some((m) => m.tier === inputs.tier)) {
      setTier(inputs.tier as ImageTier);
    }
    if (typeof inputs.count === "number" && (COUNTS as readonly number[]).includes(inputs.count)) {
      setCount(inputs.count as (typeof COUNTS)[number]);
    }
    // Older rows saved before references were tracked have no this field —
    // leave whatever's currently attached alone rather than clearing it.
    if (Array.isArray(inputs.referenceImages)) {
      setRefs(
        (inputs.referenceImages as { name: string; blob: Blob }[])
          .filter((r) => r?.blob instanceof Blob)
          .map((r) => refFromBlob(r.blob, r.name))
      );
    }
  };

  /** Attach a generated image (just made, or pulled back out of history) as
   * a reference for the next generation. */
  const attachAsReference = (blob: Blob, name: string) => addRef(refFromBlob(blob, name));

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Text to Image</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe an image and Depcut's AI model will render it.
        </p>
      </div>

      <div className="space-y-5">
        <div className="relative flex flex-col rounded-2xl border border-input bg-card focus-within:border-ring">
          <RefChips
            refs={refs}
            onRemove={(r) => setRefs((prev) => prev.filter((x) => !(x.scope === r.scope && x.id === r.id)))}
            className="p-2.5 pb-0"
            thumbClassName="size-12"
          />
          <MentionTextarea
            className="min-h-[100px] w-full resize-y bg-transparent px-3.5 py-3 text-[13px] leading-relaxed outline-none"
            placeholder="What do you want to create?"
            value={prompt}
            onChange={setPrompt}
            candidates={candidates}
            submitKey="mod-enter"
            menuSide="bottom"
            onSubmit={() => void generate()}
            attachedRefs={refs}
            uploadFile={(file) => Promise.resolve(refFromLocalFile(file))}
          />

          <div className="flex flex-col gap-2 px-3 pb-3">
            {settingsOpen && (
              <div className="flex flex-col gap-3 rounded-xl border border-input bg-muted/30 p-3">
                <AspectRow value={aspect} onChange={setAspect} />
                <div className="h-px shrink-0 bg-border" />
                <ModelRow value={tier} onChange={setTier} />
                <CountRow value={count} onChange={setCount} />
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <AddRefButton
                onPick={addRef}
                onUploadFiles={(files) => {
                  for (const file of files) addRef(refFromLocalFile(file));
                }}
                prompt={prompt}
                onPromptChange={setPrompt}
                accept="image/*,video/*"
              />
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  title="Generation settings"
                  aria-label="Generation settings"
                  aria-pressed={settingsOpen}
                  onClick={() => setSettingsOpen((v) => !v)}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    settingsOpen
                      ? "border-ring bg-muted text-foreground"
                      : "border-input text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="truncate">🍌 {model.label}</span>
                  <AspectIcon ratio={aspect} className="size-3.5 shrink-0" />
                  {aspect}
                  {count > 1 && <span>x{count}</span>}
                </button>
                <button
                  type="button"
                  title="Generate image"
                  aria-label="Generate image"
                  disabled={!prompt.trim() || signedOut || busy}
                  onClick={() => void generate()}
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {signedOut ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Generating runs on your Depcut account.{" "}
            <a className="font-medium text-blue-600 hover:underline dark:text-blue-400" href={signInUrl()}>
              Sign in
            </a>{" "}
            to continue.
          </p>
        ) : (
          error && (
            <p className="text-[11px] leading-relaxed text-red-600">
              {error.text}
              {error.credits && (
                <>
                  {" "}
                  <a
                    className="font-medium underline hover:no-underline"
                    href={creditsUrl()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Add credits
                  </a>
                </>
              )}
            </p>
          )
        )}

        {results.length > 0 && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <SectionTitle>Result</SectionTitle>
            <div className={cn("grid gap-2", results.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
              {results.map((r, i) => (
                <div key={r.url} className="group relative overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated image held only as an in-memory blob URL */}
                  <img src={r.url} alt={prompt} className="w-full rounded-lg" />
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Use as reference"
                      onClick={() => attachAsReference(r.blob, prompt.slice(0, 60) || `text-to-image-${i + 1}`)}
                      className="grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <ImagePlus className="size-3" />
                    </button>
                    <a
                      href={r.url}
                      download={`text-to-image-${i + 1}.png`}
                      title="Download"
                      className="grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <Download className="size-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ToolHistoryList
        tool="text-to-image"
        onReuse={reuse}
        renderPreview={(entry) =>
          entry.result.kind === "blob" ? (
            <ImageHistoryPreview blob={entry.result.blob} alt={entry.summary} />
          ) : null
        }
        onUseAsReference={(entry) =>
          entry.result.kind === "blob" && attachAsReference(entry.result.blob, entry.summary)
        }
      />
    </div>
  );
}

function AspectIcon({ ratio, className }: { ratio: Aspect; className?: string }) {
  const [w, h] = ratio.split(":").map(Number);
  const box = 14;
  const scale = box / Math.max(w, h);
  const rw = Math.max(3, Math.round(w * scale));
  const rh = Math.max(3, Math.round(h * scale));
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect
        x={(16 - rw) / 2}
        y={(16 - rh) / 2}
        width={rw}
        height={rh}
        rx={1.5}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
      />
    </svg>
  );
}

function AspectRow({ value, onChange }: { value: Aspect; onChange: (v: Aspect) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {ASPECTS.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg py-2 text-[10.5px] font-medium transition-colors",
            value === a
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <AspectIcon ratio={a} className="size-5" />
          {a}
        </button>
      ))}
    </div>
  );
}

function ModelRow({ value, onChange }: { value: ImageTier; onChange: (v: ImageTier) => void }) {
  const current = imageModel(value);
  return (
    <label className="relative flex items-center gap-2 rounded-lg px-1 py-1 text-[13px] font-medium">
      <span className="min-w-0 flex-1 truncate">🍌 {current.label}</span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      <select
        className="absolute inset-0 w-full cursor-pointer appearance-none opacity-0"
        value={value}
        onChange={(e) => onChange(e.target.value as ImageTier)}
      >
        {IMAGE_MODELS.map((m) => (
          <option key={m.tier} value={m.tier}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CountRow({
  value,
  onChange,
}: {
  value: (typeof COUNTS)[number];
  onChange: (v: (typeof COUNTS)[number]) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {COUNTS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "rounded-lg py-1.5 text-[12px] font-medium transition-colors",
            value === n
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          x{n}
        </button>
      ))}
    </div>
  );
}

function ImageHistoryPreview({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useBlobUrl(blob);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- a stored blob preview, not a remote image
  return <img src={url} alt={alt} className="w-full rounded-lg" />;
}
