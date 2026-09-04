"use client";

import { useEffect, useRef, useState } from "react";
import { Clipboard, Download, FileText, Mic, Pause, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { SubTabs } from "@/cut/components/SubTabs";
import { formatBytes } from "@/cut/components/desktopFolders";
import { ToolHistoryList } from "@/cut/components/ToolHistoryList";
import { NoCreditsError, transcribeBlob, transcribeSourceUrl, type TranscribeSettings } from "@/cut/lib/cloudTranscribe";
import { creditsUrl, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { useMicRecorder } from "@/cut/hooks/useMicRecorder";
import type { SubtitleCue } from "@/cut/lib/types";
import { cn } from "@/lib/utils";
import { useToolHistory } from "@/lib/toolHistory";

type Tab = "upload" | "record" | "social" | "source";
const TABS: { id: Tab; label: string }[] = [
  { id: "upload", label: "Upload File" },
  { id: "record", label: "Record Audio" },
  { id: "social", label: "Social Link" },
  { id: "source", label: "Source URL" },
];

// Detect/English/Spanish/German/French/Italian/Japanese mapped to Scribe's
// ISO-639-1 codes — a small, distinct list from tts.ts's SPEECH_LANGUAGES
// (which names TTS *output* voices, not Scribe *input* languages).
const SCRIBE_LANGUAGES: { id: string; label: string }[] = [
  { id: "auto", label: "Detect" },
  { id: "en", label: "English" },
  { id: "es", label: "Spanish" },
  { id: "de", label: "German" },
  { id: "fr", label: "French" },
  { id: "it", label: "Italian" },
  { id: "ja", label: "Japanese" },
];

const MAX_KEYTERMS = 50;
const MAX_KEYTERM_LENGTH = 49;

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

function CueList({ cues, className }: { cues: SubtitleCue[]; className?: string }) {
  return (
    <div className={cn("space-y-2 overflow-y-auto pr-1", className)}>
      {cues.map((c) => (
        <div key={c.id} className="flex gap-2.5 text-[12.5px] leading-relaxed">
          <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground">{mmss(c.start)}</span>
          <span>{c.text}</span>
        </div>
      ))}
    </div>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium">{label}</p>
        <p className="text-[10.5px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// Real transcription: the same hosted, ElevenLabs-backed transcriber the
// mic-dictation feature and the editor's Subtitles panel use
// (cloudTranscribe.ts, /api/cut-cloud/transcribe), run here on an uploaded
// file, a fresh recording, or a URL — a hosted file link, or a YouTube/TikTok
// link the transcriber fetches itself — instead of a live recording or
// project clip.
export default function SpeechToTextPage() {
  const signedOut = useSignedIn() === false;

  const [tab, setTab] = useState<Tab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [filePlaying, setFilePlaying] = useState(false);
  const filePreviewRef = useRef<HTMLAudioElement>(null);
  const [dragging, setDragging] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [socialUrl, setSocialUrl] = useState("");
  const [sourceUrlInput, setSourceUrlInput] = useState("");

  const [language, setLanguage] = useState("auto");
  const [tagAudioEvents, setTagAudioEvents] = useState(false);
  const [noVerbatim, setNoVerbatim] = useState(false);
  const [assignSpeakers, setAssignSpeakers] = useState(false);
  const [keyterms, setKeyterms] = useState<string[]>([]);
  const [keytermDraft, setKeytermDraft] = useState("");

  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [cues, setCues] = useState<SubtitleCue[] | null>(null);
  const [copied, setCopied] = useState(false);

  const mic = useMicRecorder();
  const history = useToolHistory("speech-to-text");

  // Each submit resolves in the background (see run()) — the panel below
  // always reflects whichever job most recently finished, so switching tabs
  // or picking new input mid-flight doesn't touch it.
  const switchTab = (t: Tab) => {
    if (mic.state === "recording") mic.cancel();
    setTab(t);
  };

  // The object URL only makes sense for the file that made it — release it
  // once replaced or the page unmounts.
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

  const handleRecordToggle = async () => {
    if (mic.state === "recording") {
      const blob = await mic.stop();
      if (blob) setRecordedBlob(blob);
      return;
    }
    setRecordedBlob(null);
    await mic.start();
  };

  const addKeyterm = () => {
    const term = keytermDraft.trim();
    setKeytermDraft("");
    if (!term || term.length > MAX_KEYTERM_LENGTH) return;
    if (keyterms.includes(term) || keyterms.length >= MAX_KEYTERMS) return;
    setKeyterms((prev) => [...prev, term]);
  };
  const removeKeyterm = (term: string) => setKeyterms((prev) => prev.filter((t) => t !== term));

  const missingInput =
    (tab === "upload" && !file) ||
    (tab === "record" && !recordedBlob) ||
    (tab === "social" && !socialUrl.trim()) ||
    (tab === "source" && !sourceUrlInput.trim());
  const disabled = signedOut || mic.state === "recording" || missingInput;

  // Runs in the background: the row lands in Recent History as "pending"
  // immediately, the form is free the instant this returns, and this
  // function keeps going on its own — resolving that same row (and, if it's
  // the last one to finish, the panel below) once the call actually
  // completes. Multiple submissions can be in flight at once this way.
  const run = async () => {
    if (missingInput) return;
    const summary =
      tab === "upload"
        ? file!.name
        : tab === "record"
          ? `Recording · ${new Date().toLocaleTimeString()}`
          : tab === "social"
            ? socialUrl.trim()
            : sourceUrlInput.trim();
    const languageCode = language === "auto" ? undefined : language;
    const settings: TranscribeSettings = {
      diarize: assignSpeakers,
      keyterms,
      noVerbatim,
      tagAudioEvents,
    };

    // Snapshot the job now — nothing below should read component state
    // again, since the user is free to change the form the instant this
    // function yields (creating the pending row is itself an await).
    const job =
      tab === "upload" && file
        ? () => transcribeBlob(file, languageCode, settings, true)
        : tab === "record" && recordedBlob
          ? () => transcribeBlob(recordedBlob, languageCode, settings, true)
          : tab === "social"
            ? () => transcribeSourceUrl(socialUrl.trim(), languageCode, settings)
            : () => transcribeSourceUrl(sourceUrlInput.trim(), languageCode, settings);

    const id = await history.createPending({ inputs: {}, summary });

    try {
      const result = await job();
      if (!result) throw new Error("Transcription was interrupted.");
      if (result.length === 0) throw new Error("Couldn't find any speech there.");
      setCues(result);
      setError(null);
      history.resolveEntry({
        id,
        outcome: {
          result: { data: { cues: result }, kind: "text", text: result.map((c) => c.text).join(" ") },
          status: "succeeded",
        },
      });
    } catch (e) {
      const message =
        e instanceof NoCreditsError || e instanceof Error ? e.message : "Transcription failed.";
      setError({ credits: e instanceof NoCreditsError, text: message });
      history.resolveEntry({ id, outcome: { errorMessage: message, status: "failed" } });
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
          Transcribe an upload, a live recording, or a social/media link into a timestamped transcript.
        </p>
      </div>

      <div className="space-y-5">
        <SubTabs tabs={TABS} value={tab} onChange={switchTab} />

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
                onClick={() => document.getElementById("stt-file-picker")?.click()}
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
                <span className="text-xs font-medium">Drop an audio or video file, or click to browse</span>
              </button>
            )}
            <input
              id="stt-file-picker"
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

        {tab === "record" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-6 text-center">
            <div
              className={cn(
                "grid size-12 place-items-center rounded-full border",
                mic.state === "recording" ? "border-red-500/30 bg-red-500/10" : "border-border bg-muted"
              )}
            >
              <Mic className={cn("size-5", mic.state === "recording" ? "text-red-500" : "text-muted-foreground")} />
            </div>
            {mic.state === "recording" ? (
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-red-500" />
                {mic.elapsed}
              </div>
            ) : recordedBlob ? (
              <span className="text-xs font-medium">Recording captured — ready to transcribe</span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">Record a take from your microphone</span>
            )}
            {mic.error && <p className="text-[11px] text-red-600">{mic.error}</p>}
            <Button
              type="button"
              variant={mic.state === "recording" ? "destructive" : "outline"}
              disabled={mic.state === "stopping"}
              onClick={() => void handleRecordToggle()}
            >
              {mic.state === "recording" ? "Stop recording" : recordedBlob ? "Record again" : "Start recording"}
            </Button>
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

        <div className="h-px shrink-0 bg-border" />

        <div className="space-y-1">
          <SectionTitle>Settings</SectionTitle>
          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium">Language</p>
                <p className="text-[10.5px] text-muted-foreground">The primary language spoken in the clip.</p>
              </div>
              <Select value={language} onValueChange={(value) => setLanguage(value ?? "auto")}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Detect">
                    {(value: string | null) => SCRIBE_LANGUAGES.find((l) => l.id === value)?.label ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SCRIBE_LANGUAGES.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="divide-y">
              <SettingRow
                label="Tag audio events"
                description="Note events like (laughter) or (footsteps) in the transcript."
                checked={tagAudioEvents}
                onChange={setTagAudioEvents}
              />
              <SettingRow
                label="No verbatim"
                description="Clean up filler words, false starts, and repetitions."
                checked={noVerbatim}
                onChange={setNoVerbatim}
              />
              <SettingRow
                label="Label speakers"
                description="Split the transcript into per-speaker turns."
                checked={assignSpeakers}
                onChange={setAssignSpeakers}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <SectionTitle>Boosted keyterms (optional)</SectionTitle>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent p-1.5">
            {keyterms.map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium"
              >
                {term}
                <button
                  type="button"
                  onClick={() => removeKeyterm(term)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={keytermDraft}
              onChange={(e) => setKeytermDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addKeyterm();
                } else if (e.key === "Backspace" && !keytermDraft && keyterms.length > 0) {
                  removeKeyterm(keyterms[keyterms.length - 1]);
                }
              }}
              placeholder={keyterms.length ? "" : "Type a term and press Enter"}
              className="min-w-24 flex-1 border-0 bg-transparent px-1 py-0.5 text-[12.5px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Words or phrases the model should recognize more accurately.
          </p>
        </div>

        <Button
          className="w-full"
          disabled={disabled}
          title={missingInput ? "Add a source above first" : undefined}
          onClick={() => void run()}
        >
          <FileText data-icon="inline-start" />
          Transcribe
        </Button>

        {signedOut ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Transcription runs on your DepCut account.{" "}
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
            <CueList cues={cues} className="max-h-80" />
          </div>
        )}
      </div>

      <ToolHistoryList
        tool="speech-to-text"
        onReuse={() => {
          // No source is kept, so there's nothing to refill — the row still
          // exists to read or re-download a past transcript.
        }}
        renderPreview={(entry) => {
          const entryCues =
            entry.result.kind === "text" &&
            entry.result.data &&
            typeof entry.result.data === "object" &&
            "cues" in entry.result.data
              ? (entry.result.data as { cues: SubtitleCue[] }).cues
              : null;
          if (!entryCues) return null;
          return <CueList cues={entryCues} className="max-h-60" />;
        }}
      />
    </div>
  );
}
