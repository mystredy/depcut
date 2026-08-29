"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, Download, Film, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AudioPlayer } from "@/cut/components/AudioPlayer";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { ToolHistoryList } from "@/cut/components/ToolHistoryList";
import { useSpeakerVoice, VoicePicker } from "@/cut/components/VoicePicker";
import { creditsUrl, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { cloudTranscribeRecording } from "@/cut/lib/cloudTranscribe";
import { NoCreditsError, renderSpeechClip, SPEECH_LANGUAGES } from "@/cut/lib/tts";
import { cn } from "@/lib/utils";
import { useToolHistory } from "@/lib/toolHistory";
import { useBlobUrl } from "@/lib/useBlobUrl";

// Every language but "auto" — dubbing always needs an explicit target.
const DUB_LANGUAGES = SPEECH_LANGUAGES.filter((l) => l.id !== "auto");

type Stage = "idle" | "transcribing" | "dubbing";

// Real transcribe-then-voice pipeline, both hops already used elsewhere in Cut:
// cloudTranscribeRecording (the mic-dictation transcriber) turns the upload
// into text, then renderSpeechClip's own "say it in X" direction handling
// (planVoiceover, in tts.ts) translates that text and speaks it in one hosted
// call. There's no project to land the result on outside the editor, so it
// comes back as a playable, downloadable WAV instead.
export default function DubbingPage() {
  const voice = useSpeakerVoice();
  const signedOut = useSignedIn() === false;

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [style, setStyle] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const history = useToolHistory("dubbing");

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const pickFile = (f: File) => {
    setFile(f);
    setTranscript(null);
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setError(null);
  };

  const runDub = async () => {
    if (!file || !targetLanguage) return;
    const target = DUB_LANGUAGES.find((l) => l.id === targetLanguage);
    if (!target) return;

    setError(null);
    setTranscript(null);
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });

    try {
      setStage("transcribing");
      const text = (await cloudTranscribeRecording(file, undefined, true)).trim();
      if (!text) throw new Error("Couldn't find any speech in that file.");
      setTranscript(text);

      setStage("dubbing");
      const ask = `Say it in ${target.label}.`;
      const { blob } = await renderSpeechClip([{ text, at: 0 }], {
        voice,
        direction: style.trim() ? `${style.trim()} ${ask}` : ask,
        language: target.id,
      });
      setResult({ url: URL.createObjectURL(blob) });
      history.save({
        inputs: { style, targetLanguage },
        result: { blob, data: { transcript: text }, filename: "dubbed-audio.wav", kind: "blob", mimeType: blob.type || "audio/wav" },
        summary: `${file.name} → ${target.label}`,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? { text: e.message, credits: e instanceof NoCreditsError }
          : { text: "Dubbing failed." }
      );
    } finally {
      setStage("idle");
    }
  };

  const reuse = (inputs: Record<string, unknown>) => {
    if (typeof inputs.targetLanguage === "string") setTargetLanguage(inputs.targetLanguage);
    if (typeof inputs.style === "string") setStyle(inputs.style);
  };

  const busy = stage !== "idle";
  const buttonLabel =
    stage === "transcribing" ? "Transcribing…" : stage === "dubbing" ? "Dubbing…" : "Dub audio";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Dubbing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a clip, and Depcut will transcribe it, translate the lines, and voice them in a
          new language.
        </p>
      </div>

      <div className="space-y-5 rounded-3xl border bg-card p-6">
        <div className="space-y-2">
          <Label>
            Source audio or video <span className="text-destructive">*</span>
          </Label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f?.type.startsWith("audio/") || f?.type.startsWith("video/")) pickFile(f);
            }}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
            )}
          >
            <Film className="size-6 text-muted-foreground" />
            <span className="text-xs font-medium">
              {file ? file.name : "Drop an audio or video file, or click to browse"}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
            }}
          />
        </div>

        <VoicePicker />

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Languages className="size-3.5 text-primary" />
            Dub into <span className="text-destructive">*</span>
          </Label>
          <Select value={targetLanguage} onValueChange={(value) => setTargetLanguage(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a language">
                {(value: string | null) => DUB_LANGUAGES.find((l) => l.id === value)?.label ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DUB_LANGUAGES.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <SectionTitle>Delivery style (optional)</SectionTitle>
          <textarea
            rows={2}
            className="min-h-[52px] w-full resize-y rounded-lg border border-input bg-transparent p-2.5 text-[12.5px] leading-relaxed outline-none focus:border-ring"
            placeholder="Say warmly, like an old friend"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          />
        </div>

        <Button
          className="w-full"
          disabled={!file || !targetLanguage || signedOut || busy}
          title={!file ? "Add a file above first" : !targetLanguage ? "Choose a target language" : undefined}
          onClick={() => void runDub()}
        >
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Captions data-icon="inline-start" />}
          {buttonLabel}
        </Button>

        {signedOut ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Dubbing runs on your Depcut account.{" "}
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

        {transcript && (
          <div className="space-y-1.5 rounded-xl border bg-muted/30 p-3">
            <SectionTitle>Detected speech</SectionTitle>
            <p className="text-[12.5px] leading-relaxed">{transcript}</p>
          </div>
        )}

        {result && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Dubbed result</SectionTitle>
              <a
                href={result.url}
                download="dubbed-audio.wav"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Download className="size-3.5" />
                Download
              </a>
            </div>
            <AudioPlayer src={result.url} />
          </div>
        )}
      </div>

      <ToolHistoryList
        tool="dubbing"
        onReuse={reuse}
        renderPreview={(entry) =>
          entry.result.kind === "blob" ? <DubHistoryPreview result={entry.result} /> : null
        }
      />
    </div>
  );
}

function DubHistoryPreview({
  result,
}: {
  result: { blob: Blob; data?: unknown };
}) {
  const url = useBlobUrl(result.blob);
  const transcript =
    result.data && typeof result.data === "object" && "transcript" in result.data
      ? (result.data as { transcript: string }).transcript
      : null;
  return (
    <div className="space-y-2">
      {transcript && <p className="text-[12.5px] leading-relaxed text-muted-foreground">{transcript}</p>}
      {url && <AudioPlayer src={url} />}
    </div>
  );
}
