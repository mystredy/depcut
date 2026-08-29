"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/cut/components/PillSelect";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { ToolHistoryList } from "@/cut/components/ToolHistoryList";
import { bytesFromBase64 } from "@/cut/lib/bytes";
import { creditsUrl, NO_CREDITS_MESSAGE, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { hostedPost } from "@/cut/lib/hosted";
import {
  IMAGE_ASPECTS,
  IMAGE_RESOLUTION_LABEL,
  type ImageAspect,
  type ImageResolution,
} from "@/cut/lib/imageGen";
import { useToolHistory } from "@/lib/toolHistory";
import { useBlobUrl } from "@/lib/useBlobUrl";

const ASPECT_WORD: Record<ImageAspect, string> = { "16:9": "Landscape", "9:16": "Portrait", "1:1": "Square" };

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

// Standalone version of the Image tab's generate panel: the same hosted image
// model (kind: "image" on /api/inference/assets), minus the project — the
// render comes back as a plain downloadable file instead of landing as project
// media.
export default function TextToImagePage() {
  const signedIn = useSignedIn();
  const signedOut = signedIn === false;

  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<ImageAspect>("16:9");
  const [resolution, setResolution] = useState<ImageResolution>("2K");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const history = useToolHistory("text-to-image");

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const generate = async () => {
    const text = prompt.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await hostedPost("/api/inference/assets", {
        kind: "image",
        prompt: text,
        parameters: { aspectRatio: aspect, imageSize: resolution },
      });
      if (!res.ok) throw new Error(await readError(res, "Image generation failed."));
      const gen = (await res.json()) as GenerationResponse;
      const out = gen.outputs.find((o) => o.dataBase64);
      if (!out?.dataBase64) throw new Error("The provider returned no image.");
      const blob = new Blob([bytesFromBase64(out.dataBase64)], {
        type: out.contentType ?? "image/png",
      });
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob) };
      });
      history.save({
        inputs: { aspect, prompt: text, resolution },
        result: { blob, filename: "text-to-image.png", kind: "blob", mimeType: blob.type || "image/png" },
        status: "succeeded",
        summary: text.slice(0, 80),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Image generation failed.";
      setError({ text: message, credits: message === NO_CREDITS_MESSAGE });
      history.save({
        errorMessage: message,
        inputs: { aspect, prompt: text, resolution },
        status: "failed",
        summary: text.slice(0, 80),
      });
    } finally {
      setBusy(false);
    }
  };

  const reuse = (inputs: Record<string, unknown>) => {
    if (typeof inputs.prompt === "string") setPrompt(inputs.prompt);
    if (typeof inputs.aspect === "string" && (IMAGE_ASPECTS as string[]).includes(inputs.aspect)) {
      setAspect(inputs.aspect as ImageAspect);
    }
    if (
      typeof inputs.resolution === "string" &&
      inputs.resolution in IMAGE_RESOLUTION_LABEL
    ) {
      setResolution(inputs.resolution as ImageResolution);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Text to Image</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe an image and Depcut's AI model will render it.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <SectionTitle>Prompt</SectionTitle>
          <textarea
            className="min-h-[100px] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-[12.5px] leading-relaxed outline-none focus:border-ring"
            placeholder="A neon-lit street market at night, cinematic…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <PillSelect
            className="min-w-0 flex-1"
            title="Aspect ratio"
            value={aspect}
            display={ASPECT_WORD[aspect]}
            options={IMAGE_ASPECTS.map((a) => ({ value: a, label: `${ASPECT_WORD[a]} · ${a}` }))}
            onChange={setAspect}
          />
          <PillSelect
            title="Resolution"
            value={resolution}
            display={resolution}
            options={(Object.keys(IMAGE_RESOLUTION_LABEL) as ImageResolution[]).map((r) => ({
              value: r,
              label: IMAGE_RESOLUTION_LABEL[r],
            }))}
            onChange={setResolution}
          />
        </div>

        <Button className="w-full" disabled={!prompt.trim() || signedOut || busy} onClick={() => void generate()}>
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
          Generate image
        </Button>

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

        {result && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Result</SectionTitle>
              <a
                href={result.url}
                download="text-to-image.png"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Download className="size-3.5" />
                Download
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- generated image held only as an in-memory blob URL */}
            <img src={result.url} alt={prompt} className="w-full rounded-lg" />
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
      />
    </div>
  );
}

function ImageHistoryPreview({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useBlobUrl(blob);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- a stored blob preview, not a remote image
  return <img src={url} alt={alt} className="w-full rounded-lg" />;
}
