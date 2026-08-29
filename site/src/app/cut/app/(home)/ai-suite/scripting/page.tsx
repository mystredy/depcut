"use client";

import { useState } from "react";
import { Clipboard, Download, Loader2, NotebookPen } from "lucide-react";
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
import { SectionTitle } from "@/cut/components/SectionTitle";
import { ToolHistoryList } from "@/cut/components/ToolHistoryList";
import { creditsUrl, NO_CREDITS_MESSAGE, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { hostedPost } from "@/cut/lib/hosted";
import { useToolHistory } from "@/lib/toolHistory";

const DURATIONS = ["15 seconds", "30 seconds", "60 seconds", "2–3 minutes", "5+ minutes"];
const PLATFORMS = ["General", "YouTube", "TikTok / Reels / Shorts", "Instagram", "LinkedIn"];

type ChatCompletion = { choices: { message: { content: string } }[] };

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "Sign in to Depcut to generate a script.";
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

function buildPrompt(topic: string, duration: string, platform: string, tone: string): string {
  return `Write a video script.
Topic: ${topic}
Target length: ${duration}
Platform: ${platform}
${tone.trim() ? `Tone: ${tone.trim()}` : ""}

Format it exactly like this, no extra commentary before or after:
HOOK: one or two sentences that grab attention in the first 3 seconds.

SCENES:
1. Visual: ...
   Voiceover: ...
2. Visual: ...
   Voiceover: ...
(as many scenes as the target length needs)

CTA: a short closing call to action.`;
}

// Real single-shot generation over the same hosted chat endpoint the AI
// Chatbot page and Submit Project's "Generate" buttons call — a structured
// prompt asking for a hook/scenes/CTA script instead of a free-form reply.
export default function ScriptingPage() {
  const signedOut = useSignedIn() === false;

  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [tone, setTone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const history = useToolHistory("scripting");

  const generate = async () => {
    const text = topic.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setScript(null);
    try {
      const res = await hostedPost("/api/inference/chat/completions", {
        messages: [{ role: "user", content: buildPrompt(text, duration, platform, tone) }],
      });
      if (!res.ok) throw new Error(await readError(res, "Script generation failed."));
      const data = (await res.json()) as ChatCompletion;
      const reply = data.choices[0]?.message.content?.trim();
      if (!reply) throw new Error("The assistant returned an empty script.");
      setScript(reply);
      history.save({
        inputs: { duration, platform, tone, topic: text },
        result: { kind: "text", text: reply },
        summary: text.slice(0, 80),
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? { text: e.message, credits: e.message === NO_CREDITS_MESSAGE }
          : { text: "Script generation failed." }
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!script) return;
    void navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const download = () => {
    if (!script) return;
    const url = URL.createObjectURL(new Blob([script], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "script.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reuse = (inputs: Record<string, unknown>) => {
    if (typeof inputs.topic === "string") setTopic(inputs.topic);
    if (typeof inputs.duration === "string") setDuration(inputs.duration);
    if (typeof inputs.platform === "string") setPlatform(inputs.platform);
    if (typeof inputs.tone === "string") setTone(inputs.tone);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Scripting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe a video idea and get a hook, scene-by-scene breakdown, and a closing CTA.
        </p>
      </div>

      <div className="space-y-5 rounded-3xl border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="script-topic">
            What's the video about? <span className="text-destructive">*</span>
          </Label>
          <Input
            id="script-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. 3 morning habits that changed my productivity"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Target length</Label>
            <Select value={duration} onValueChange={(value) => value && setDuration(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(value) => value && setPlatform(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="script-tone">Tone (optional)</Label>
          <Input
            id="script-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g. energetic and funny, calm and professional"
          />
        </div>

        <Button className="w-full" disabled={!topic.trim() || signedOut || busy} onClick={() => void generate()}>
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <NotebookPen data-icon="inline-start" />}
          {busy ? "Writing…" : "Write script"}
        </Button>

        {signedOut ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Scripting runs on your Depcut account.{" "}
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

        {script && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Script</SectionTitle>
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
                  onClick={download}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Download className="size-3.5" />
                  .txt
                </button>
              </div>
            </div>
            <p className="max-h-96 overflow-y-auto text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {script}
            </p>
          </div>
        )}
      </div>

      <ToolHistoryList
        tool="scripting"
        onReuse={reuse}
        renderPreview={(entry) =>
          entry.result.kind === "text" ? (
            <p className="max-h-60 overflow-y-auto text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {entry.result.text}
            </p>
          ) : null
        }
      />
    </div>
  );
}
