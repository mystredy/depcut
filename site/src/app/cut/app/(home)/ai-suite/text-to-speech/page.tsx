"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Check, ChevronDown, Download, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { useSpeakerVoice, useSpeechLanguage, VoicePicker } from "@/cut/components/VoicePicker";
import { creditsUrl, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { NoCreditsError, renderSpeechClip } from "@/cut/lib/tts";

// Starting points for the direction prompt — same set the Audio panel's voice
// generator offers, picking one fills the input so it can be tweaked.
const DIRECTION_PRESETS: { label: string; text: string }[] = [
  { label: "Warm", text: "Say warmly, like an old friend" },
  { label: "Energetic", text: "Say with high energy, like a hype announcer" },
  { label: "Documentary", text: "Narrate calmly and evenly, like a nature documentary" },
  { label: "Movie trailer", text: "Say dramatically, with gravity, like a movie trailer" },
  { label: "News anchor", text: "Read briskly and clearly, like a news anchor" },
  { label: "Whisper", text: "Whisper softly, close to the mic" },
  { label: "Bedtime story", text: "Read slowly and gently, like a bedtime story" },
];

type Result = { url: string; language?: string };

// Standalone version of the Audio panel's voice generator: same hosted speech
// backend (Gemini TTS via renderSpeechClip) and the same shared voice/direction
// picker, minus the project timeline — the clip renders to a playable,
// downloadable WAV instead of landing on a soundtrack.
export default function TextToSpeechPage() {
  const voice = useSpeakerVoice();
  const language = useSpeechLanguage();
  const signedOut = useSignedIn() === false;

  const [script, setScript] = useState("");
  const [direction, setDirection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const directionInput = useRef<HTMLTextAreaElement>(null);

  // The object URL only makes sense for the clip that made it — release it
  // once replaced or the page unmounts.
  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const generate = async () => {
    const text = script.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, language: spoken } = await renderSpeechClip([{ text, at: 0 }], {
        voice,
        direction,
        language,
      });
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob), language: spoken };
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? { text: e.message, credits: e instanceof NoCreditsError }
          : { text: "Voice generation failed." }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Text to Speech</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn a script into a spoken audio clip with one of Depcut's AI voices.
        </p>
      </div>

      <div className="space-y-5 rounded-3xl border bg-card p-6">
        <VoicePicker direction={direction} onError={(e) => setError(e instanceof Error ? { text: e.message } : { text: "Could not play the sample." })} />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <SectionTitle>Voice direction</SectionTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  className="grid size-4 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="About voice direction"
                >
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-60">
                  Optional. Tell the voice how to deliver the lines — its tone, pace, and energy, or
                  ask it to speak in another language.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="relative">
            <textarea
              ref={directionInput}
              rows={2}
              className="min-h-[52px] w-full resize-y rounded-lg border border-input bg-transparent py-2 pr-9 pl-2.5 text-[12.5px] leading-relaxed outline-none focus:border-ring"
              placeholder="Say warmly, like an old friend"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                className="absolute top-1.5 right-1 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Direction presets"
              >
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {DIRECTION_PRESETS.map((p) => (
                  <DropdownMenuItem key={p.label} onClick={() => setDirection(p.text)}>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[12px] font-medium">{p.label}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{p.text}</span>
                    </div>
                    {direction === p.text && <Check className="size-3.5 shrink-0" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setDirection("");
                    setTimeout(() => directionInput.current?.focus(), 0);
                  }}
                >
                  <span className="text-[12px] font-medium">Custom…</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="h-px shrink-0 bg-border" />

        <div className="flex flex-col gap-2">
          <SectionTitle>Script</SectionTitle>
          <textarea
            className="min-h-[120px] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-[12.5px] leading-relaxed outline-none focus:border-ring"
            placeholder="What should the voice say?"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={!script.trim() || signedOut || busy}
            title={!script.trim() ? "Write a script above to generate" : undefined}
            onClick={() => void generate()}
          >
            {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <AudioLines data-icon="inline-start" />}
            Generate audio
          </Button>
        </div>

        {signedOut ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Voiceovers run on your Depcut account.{" "}
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
                download="text-to-speech.wav"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Download className="size-3.5" />
                Download
              </a>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- generated speech has no separate caption track */}
            <audio controls src={result.url} className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
