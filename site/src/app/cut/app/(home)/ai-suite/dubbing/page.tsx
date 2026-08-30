"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, Download, FileText, Film, Languages, Loader2, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { SubTabs } from "@/cut/components/SubTabs";
import { ToolHistoryList } from "@/cut/components/ToolHistoryList";
import { useSpeakerVoice, VoicePicker } from "@/cut/components/VoicePicker";
import { formatBytes } from "@/cut/components/desktopFolders";
import { creditsUrl, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { cloudTranscribeRecording, transcribeSourceUrl } from "@/cut/lib/cloudTranscribe";
import { NoCreditsError, renderSpeechClip, SPEECH_LANGUAGES } from "@/cut/lib/tts";
import { cn } from "@/lib/utils";
import { useToolHistory } from "@/lib/toolHistory";
import { useBlobUrl } from "@/lib/useBlobUrl";

// Every language but "auto" — dubbing always needs an explicit target.
const DUB_LANGUAGES = SPEECH_LANGUAGES.filter((l) => l.id !== "auto");

type Tab = "upload" | "social" | "source";
const TABS: { id: Tab; label: string }[] = [
  { id: "upload", label: "Upload File" },
  { id: "social", label: "Social Link" },
  { id: "source", label: "Source URL" },
];

type Stage = "idle" | "transcribing" | "dubbing";

function mmss(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Real transcribe-then-voice pipeline, both hops already used elsewhere in Cut:
// an upload goes through cloudTranscribeRecording (the mic-dictation
// transcriber), a social/source link through transcribeSourceUrl (the hosted
// transcriber fetching the link itself) — either way the result is plain
// text, which renderSpeechClip's own "say it in X" direction handling
// (planVoiceover, in tts.ts) translates and speaks in one hosted call.
// There's no project to land the result on outside the editor, so it comes
// back as a playable, downloadable WAV instead.
export default function DubbingPage() {
  const voice = useSpeakerVoice();
  const signedOut = useSignedIn() === false;

  const [tab, setTab] = useState<Tab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [filePlaying, setFilePlaying] = useState(false);
  const filePreviewRef = useRef<HTMLAudioElement>(null);
  const [dragging, setDragging] = useState(false);
  const [socialUrl, setSocialUrl] = useState("");
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [style, setStyle] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const history = useToolHistory("dubbing");

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const pickFile = (f: File) => {
    setFile(f);
    setFileDuration(null);
    setFilePlaying(false);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setTranscript(null);
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setError(null);
  };

  const clearFile = () => {
    setFile(null);
    setFileDuration(null);
    setFilePlaying(false);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const toggleFilePlay = () => {
    const el = filePreviewRef.current;
    if (!el) return;
    if (filePlaying) el.pause();
    else void el.play();
  };

  const missingInput =
    (tab === "upload" && !file) ||
    (tab === "social" && !socialUrl.trim()) ||
    (tab === "source" && !sourceUrlInput.trim());

  const runDub = async () => {
    if (missingInput || !targetLanguage) return;
    const target = DUB_LANGUAGES.find((l) => l.id === targetLanguage);
    if (!target) return;
    const sourceLabel = tab === "upload" ? file!.name : tab === "social" ? socialUrl.trim() : sourceUrlInput.trim();

    setError(null);
    setTranscript(null);
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });

    try {
      setStage("transcribing");
      const text =
        tab === "upload"
          ? (await cloudTranscribeRecording(file!, undefined, true)).trim()
          : (await transcribeSourceUrl(tab === "social" ? socialUrl.trim() : sourceUrlInput.trim(), undefined))
              .map((c) => c.text)
              .join(" ")
              .trim();
      if (!text) throw new Error("Couldn't find any speech there.");
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
        status: "succeeded",
        summary: `${sourceLabel} → ${target.label}`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Dubbing failed.";
      setError({ text: message, credits: e instanceof NoCreditsError });
      history.save({
        errorMessage: message,
        inputs: { style, targetLanguage },
        status: "failed",
        summary: `${sourceLabel} → ${target.label}`,
      });
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
          Upload a clip, or paste a link, and Depcut will transcribe it, translate the lines, and
          voice them in a new language.
        </p>
      </div>

      <div className="space-y-5">
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === "upload" && (
          <div className="space-y-2">
            <Label>
              Source audio or video <span className="text-destructive">*</span>
            </Label>
            {file ? (
              <div className="flex w-full items-center gap-3 rounded-2xl border border-border p-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{file.name}</p>
                  <p className="text-[10.5px] text-muted-foreground">
                    {fileDuration != null ? `${mmss(fileDuration)} · ` : ""}
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleFilePlay}
                  disabled={fileDuration == null}
                  title={filePlaying ? "Pause" : "Play"}
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  {filePlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={clearFile}
                  title="Remove"
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a picked file's own preview, not authored content */}
                <audio
                  ref={filePreviewRef}
                  src={fileUrl ?? undefined}
                  className="hidden"
                  onLoadedMetadata={(e) => setFileDuration(e.currentTarget.duration)}
                  onPlay={() => setFilePlaying(true)}
                  onPause={() => setFilePlaying(false)}
                  onEnded={() => setFilePlaying(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById("dub-file-picker")?.click()}
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
                <span className="text-xs font-medium">Drop an audio or video file, or click to browse</span>
              </button>
            )}
            <input
              id="dub-file-picker"
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
              }}
            />
          </div>
        )}

        {tab === "social" && (
          <div className="space-y-2">
            <Label>
              Social video or audio link <span className="text-destructive">*</span>
            </Label>
            <Input
              value={socialUrl}
              onChange={(e) => setSocialUrl(e.target.value)}
              placeholder="Paste a YouTube, TikTok, or other social link"
            />
          </div>
        )}

        {tab === "source" && (
          <div className="space-y-2">
            <Label>
              Direct audio or video URL <span className="text-destructive">*</span>
            </Label>
            <Input
              value={sourceUrlInput}
              onChange={(e) => setSourceUrlInput(e.target.value)}
              placeholder="https://example.com/clip.mp3"
            />
          </div>
        )}

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
          disabled={missingInput || !targetLanguage || signedOut || busy}
          title={missingInput ? "Add a source above first" : !targetLanguage ? "Choose a target language" : undefined}
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
