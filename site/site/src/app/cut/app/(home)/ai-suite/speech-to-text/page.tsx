"use client";

import { useRef, useState } from "react";
import { Clipboard, Download, FileText, Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { signInUrl, useSignedIn } from "@/cut/lib/generate";
import { transcribeSamples } from "@/cut/lib/cloudTranscribe";
import type { SubtitleCue } from "@/cut/lib/types";
import { cn } from "@/lib/utils";

// The wire format the hosted transcriber expects (mirrors cloudTranscribe.ts,
// whose own constant isn't exported).
const RATE = 16000;

/** Decode an uploaded file's audio, resample it to the transcriber's mono
 * 16 kHz wire format, and transcribe it — the same steps
 * cloudTranscribeRecording runs for mic dictation, just returning the timed
 * cues instead of one joined string. */
async function transcribeFile(file: File): Promise<SubtitleCue[]> {
  const bytes = await file.arrayBuffer();
  const probe = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await probe.decodeAudioData(bytes);
  } catch {
    throw new Error("Could not read that file's audio.");
  } finally {
    void probe.close().catch(() => {});
  }
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
  const src = ctx.createBufferSource();
  src.buffer = decoded;
  src.connect(ctx.destination);
  src.start();
  const mono = (await ctx.startRendering()).getChannelData(0);
  const cues = await transcribeSamples(mono, undefined);
  if (!cues) throw new Error("Transcription was interrupted.");
  if (cues.length === 0) throw new Error("Couldn't find any speech in that file.");
  return cues;
}

function mmss(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function srtTimestamp(t: number): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(
    Math.floor((ms % 60000) / 1000)
  )},${pad(ms % 1000, 3)}`;
}

function toSrt(cues: SubtitleCue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${srtTimestamp(c.start)} --> ${srtTimestamp(c.end)}\n${c.text}\n`)
    .join("\n");
}

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Real transcription: the same hosted transcriber the mic-dictation feature
// and the editor's Subtitles panel use (cloudTranscribe.ts, /api/cut/transcribe),
// run here on an uploaded file instead of a live recording or project clip.
export default function SpeechToTextPage() {
  const signedOut = useSignedIn() === false;

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cues, setCues] = useState<SubtitleCue[] | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File) => {
    setFile(f);
    setCues(null);
    setError(null);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setCues(null);
    try {
      setCues(await transcribeFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed.");
    } finally {
      setBusy(false);
    }
  };

  const transcript = cues?.map((c) => c.text).join(" ") ?? "";

  const copy = () => {
    void navigator.clipboard.writeText(transcript).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Speech to Text</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a clip and get a timestamped transcript.
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
            <Mic className="size-6 text-muted-foreground" />
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

        <Button
          className="w-full"
          disabled={!file || signedOut || busy}
          title={!file ? "Add a file above first" : undefined}
          onClick={() => void run()}
        >
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileText data-icon="inline-start" />}
          {busy ? "Transcribing…" : "Transcribe"}
        </Button>

        {signedOut ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Transcription runs on your Donkey account.{" "}
            <a className="font-medium text-blue-600 hover:underline dark:text-blue-400" href={signInUrl()}>
              Sign in
            </a>{" "}
            to continue.
          </p>
        ) : (
          error && <p className="text-[11px] leading-relaxed text-red-600">{error}</p>
        )}

        {cues && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Transcript</SectionTitle>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={copy}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Clipboard className="size-3.5" />
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => download(transcript, "transcript.txt", "text/plain")}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Download className="size-3.5" />
                  .txt
                </button>
                <button
                  type="button"
                  onClick={() => download(toSrt(cues), "transcript.srt", "text/plain")}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Download className="size-3.5" />
                  .srt
                </button>
              </div>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {cues.map((c) => (
                <div key={c.id} className="flex gap-2.5 text-[12.5px] leading-relaxed">
                  <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {mmss(c.start)}
                  </span>
                  <span>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
