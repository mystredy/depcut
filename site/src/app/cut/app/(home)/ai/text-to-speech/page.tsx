"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Check, ChevronDown, Download, Info, LibraryBig, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AudioModelPicker } from "@/cut/components/AudioModelPicker";
import { AudioPlayer } from "@/cut/components/AudioPlayer";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { ElevenLabsVoicePicker } from "@/cut/components/ElevenLabsVoicePicker";
import { MediaGenerationHistory } from "@/cut/components/MediaGenerationHistory";
import { ValueSlider } from "@/cut/components/ValueSlider";
import { useSpeakerVoice, useSpeechLanguage, VoicePicker } from "@/cut/components/VoicePicker";
import { DEFAULT_AUDIO_MODEL, resolveAudioModel, type AudioModel } from "@/cut/lib/audioModels";
import { persistAudioGeneration } from "@/cut/lib/audioGenerationPersist";
import { accentFor } from "@/cut/lib/colorAccent";
import { DEFAULT_CREDIT_RATE, dollarsToCredits, type CreditRate } from "@/lib/credits/format-credits";
import { providerCreditPricing } from "@/lib/credits/provider-pricing";
import { usePublicSiteSettings } from "@/queries/site";
import { creditsUrl, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { uploadToLibrary } from "@/cut/lib/library";
import { NoCreditsError, renderElevenLabsClip, renderSpeechClip } from "@/cut/lib/tts";
import { SPEECH_VOICES } from "@/cut/lib/voices";
import { cn } from "@/lib/utils";

// The client-facing shape of a GET /api/audio-generations row — createdAt is
// a string here (JSON, not the server's Date) once it's crossed the wire.
type AudioHistoryRow = {
  id: string;
  script: string;
  direction: string | null;
  voice: string;
  outputUrl: string;
  downloadUrl: string;
  outputMime: string;
  createdAt: string;
};

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

// Script starting points, one per common voice-over use case — filling the
// script so it can be edited rather than generating anything by itself.
const SCRIPT_PRESETS: { label: string; text: string }[] = [
  {
    label: "Podcast Intro",
    text: "Welcome back to the show. I'm your host, and today we're diving into a topic I've been excited to share with you.",
  },
  {
    label: "Product Explainer",
    text: "Meet the simplest way to get more done in less time. No setup, no learning curve — just open it and go.",
  },
  {
    label: "Ad Teaser",
    text: "Introducing the one thing your routine has been missing. Ready in seconds. Built to last.",
  },
  {
    label: "Brand Story",
    text: "Every great idea starts with a problem worth solving. Ours began with a simple question: why does this have to be so hard?",
  },
];

const SPEED_MIN = 0.7;
const SPEED_MAX = 1.2;

type Result = { url: string; blob: Blob; language?: string };


// Standalone version of the Audio panel's voice generator: DepCut's hosted
// Gemini voices by default, or ElevenLabs (Eleven v3 / Multilingual v2) —
// same shared voice/direction picker for Gemini, minus the project timeline;
// a generated clip renders to a playable, downloadable file instead of
// landing on a soundtrack.
export default function TextToSpeechPage() {
  const geminiVoice = useSpeakerVoice();
  const language = useSpeechLanguage();
  const signedOut = useSignedIn() === false;

  const [audioModel, setAudioModel] = useState<AudioModel>(() => resolveAudioModel(DEFAULT_AUDIO_MODEL));
  const [elevenVoiceId, setElevenVoiceId] = useState<string | null>(null);
  const [elevenVoiceName, setElevenVoiceName] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);

  const [script, setScript] = useState("");
  const [direction, setDirection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [libraryState, setLibraryState] = useState<"idle" | "adding" | "added">("idle");
  const directionInput = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // The balance and every price on screen show as "credits" at the
  // admin-configurable rate (see format-credits.ts) — never raw dollars.
  const siteSettings = usePublicSiteSettings();
  const creditRate: CreditRate = siteSettings.data
    ? { credits: siteSettings.data.settings.creditRateCredits, dollars: siteSettings.data.settings.creditRateDollars }
    : DEFAULT_CREDIT_RATE;

  // ElevenLabs bills by input characters, so this is exact. Gemini bills by
  // output duration, which isn't known until the clip renders — estimated
  // from a standard ~150-words-per-minute speaking rate (≈15 characters per
  // second) instead.
  const ESTIMATED_CHARS_PER_SECOND = 15;
  const cost = useMemo(() => {
    const chars = script.trim().length;
    if (chars === 0) return null;
    if (audioModel.provider === "elevenlabs") {
      const pricing = providerCreditPricing("elevenlabs", audioModel.model);
      if (!pricing?.characterCostMicros) return null;
      return { micros: BigInt(chars) * pricing.characterCostMicros, exact: true };
    }
    const pricing = providerCreditPricing("gemini-tts", audioModel.model);
    if (!pricing?.durationSecondCostMicros) return null;
    const estimatedSeconds = Math.max(1, Math.ceil(chars / ESTIMATED_CHARS_PER_SECOND));
    return { micros: BigInt(estimatedSeconds) * pricing.durationSecondCostMicros, exact: false };
  }, [script, audioModel]);

  const costLabel = (() => {
    if (!cost) return null;
    const dollars = Number(cost.micros) / 1_000_000;
    const credits = dollarsToCredits(dollars, creditRate);
    const amount = credits < 1 ? "<1 credit" : `${credits.toLocaleString("en-US")} credit${credits === 1 ? "" : "s"}`;
    return cost.exact ? `Costs ${amount}` : `Est. ${amount}`;
  })();

  // The object URL only makes sense for the clip that made it — release it
  // once replaced or the page unmounts.
  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  // A generation (especially Eleven v3) routinely takes 60-100+ seconds with
  // nothing on screen but a spinner — long enough that a user who doesn't
  // know that will assume it's stuck and reload or navigate away. The
  // request already in flight server-side has no idea the tab is gone: it
  // finishes and bills regardless, for a result the user never sees. This
  // warns before that happens rather than losing the credits silently.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // beforeunload only covers closing the tab or a hard reload — it never
  // fires for a click on another sidebar item, which just unmounts this page
  // client-side. That's the more likely escape hatch for someone who thinks
  // a 90-second spinner means it's stuck, so it needs its own guard.
  useEffect(() => {
    if (!busy) return;
    const guard = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.("a[href]");
      const href = anchor?.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const leave = window.confirm(
        "A voice generation is still running and will be billed either way — leaving now just means you won't see the result. Leave anyway?"
      );
      if (!leave) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [busy]);

  const generate = async () => {
    const text = script.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      let blob: Blob;
      let spoken: string | undefined;
      if (audioModel.provider === "elevenlabs") {
        if (!elevenVoiceId) throw new Error("Choose a voice first.");
        ({ blob } = await renderElevenLabsClip(text, {
          model: audioModel.model,
          voiceId: elevenVoiceId,
          speed,
        }));
      } else {
        ({ blob, language: spoken } = await renderSpeechClip([{ text, at: 0 }], {
          voice: geminiVoice,
          direction,
          language,
        }));
      }
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob), blob, language: spoken };
      });
      setLibraryState("idle");
      const voiceName =
        audioModel.provider === "elevenlabs"
          ? (elevenVoiceName ?? "ElevenLabs")
          : (SPEECH_VOICES.find((v) => v.id === geminiVoice)?.name ?? geminiVoice);
      await persistAudioGeneration(blob, {
        script: text,
        voice: voiceName,
        direction: direction.trim() || undefined,
        language: spoken,
      });
      void queryClient.invalidateQueries({ queryKey: ["audio-generations"] });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Voice generation failed.";
      setError({ text: message, credits: e instanceof NoCreditsError });
    } finally {
      setBusy(false);
    }
  };

  const addToLibrary = async () => {
    if (!result || libraryState !== "idle") return;
    setLibraryState("adding");
    setError(null);
    try {
      // The script becomes the file's name, so it needs to survive as one —
      // strip anything that isn't safe in a filename rather than pass the
      // raw line through.
      const safeName = script.trim().replace(/[^\p{L}\p{N} -]+/gu, "").trim().slice(0, 60);
      const ext = result.blob.type.includes("mpeg") || result.blob.type.includes("mp3") ? "mp3" : "wav";
      const file = new File([result.blob], `${safeName || "text-to-speech"}.${ext}`, {
        type: result.blob.type || "audio/wav",
      });
      await uploadToLibrary(file);
      setLibraryState("added");
    } catch (e) {
      setLibraryState("idle");
      setError(e instanceof Error ? { text: e.message } : { text: "Could not add to library." });
    }
  };

  // The voice/language pickers are a shared cross-tool preference (see
  // VoicePicker.tsx), not per-generation state — "Use again" leaves them
  // alone and only refills what's actually local to this form.
  const reuse = (row: AudioHistoryRow) => {
    setScript(row.script);
    setDirection(row.direction ?? "");
  };

  // The Generations row menu's "Add to library" — same upload as the
  // in-page result, just fetching a past render's own stored clip first
  // instead of using the blob already in hand.
  const addHistoryEntryToLibrary = async (row: AudioHistoryRow) => {
    try {
      const blob = await fetch(row.outputUrl).then((r) => r.blob());
      const safeName = row.script.trim().replace(/[^\p{L}\p{N} -]+/gu, "").trim().slice(0, 60);
      const ext = row.outputMime.includes("mpeg") || row.outputMime.includes("mp3") ? "mp3" : "wav";
      const file = new File([blob], `${safeName || "text-to-speech"}.${ext}`, {
        type: row.outputMime || "audio/wav",
      });
      await uploadToLibrary(file);
    } catch (e) {
      setError(e instanceof Error ? { text: e.message } : { text: "Could not add to library." });
    }
  };

  return (
    <div className="w-full space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Text to Speech</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn a script into a spoken audio clip with an AI voice.
        </p>
      </div>

      <div className="space-y-5">
        <AudioModelPicker model={audioModel} onChange={setAudioModel} />

        {audioModel.provider === "gemini" ? (
          <>
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
          </>
        ) : (
          <>
            <ElevenLabsVoicePicker
              voiceId={elevenVoiceId}
              onChange={(voice) => {
                setElevenVoiceId(voice.id);
                setElevenVoiceName(voice.name);
              }}
              onError={(e) => setError(e instanceof Error ? { text: e.message } : { text: "Could not load voices." })}
            />

            <div className="flex flex-col gap-1.5">
              <SectionTitle>Voice control — speed</SectionTitle>
              <div className="flex items-center gap-3 rounded-lg border border-input px-2.5 py-2">
                <ValueSlider
                  label="Speed"
                  value={speed}
                  min={SPEED_MIN}
                  max={SPEED_MAX}
                  step={0.05}
                  format={(v) => `${v.toFixed(2)}x`}
                  parse={(raw) => {
                    const n = Number(raw.replace(/x$/i, ""));
                    return Number.isFinite(n) ? n : null;
                  }}
                  onCommit={setSpeed}
                  sliderClassName="data-horizontal:w-full"
                  valueClassName="w-12 shrink-0 text-right text-[12px] tabular-nums"
                />
              </div>
            </div>
          </>
        )}

        <div className="h-px shrink-0 bg-border" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionTitle>Script</SectionTitle>
            <div className="flex flex-wrap items-center gap-1">
              {SCRIPT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setScript(p.text)}
                  className={cn(
                    "rounded-full border border-input px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="min-h-[120px] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-[12.5px] leading-relaxed outline-none focus:border-ring"
            placeholder="What should the voice say?"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={!script.trim() || signedOut || busy || (audioModel.provider === "elevenlabs" && !elevenVoiceId)}
            title={!script.trim() ? "Write a script above to generate" : undefined}
            onClick={() => void generate()}
          >
            {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <AudioLines data-icon="inline-start" />}
            Generate audio
          </Button>
          {busy ? (
            <p className="text-center text-[11px] text-muted-foreground">
              Generating — this can take a minute or two, especially with Eleven v3. Stay on this
              page; leaving won&apos;t stop the charge, only the result reaching you.
            </p>
          ) : (
            costLabel && (
              <p className="text-center text-[11px] text-muted-foreground">
                {costLabel}
                {!cost?.exact && " (estimated — Gemini bills by the clip's actual length)"}
              </p>
            )
          )}
        </div>

        {signedOut ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Voiceovers run on your DepCut account.{" "}
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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={libraryState !== "idle"}
                  onClick={() => void addToLibrary()}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-60"
                >
                  {libraryState === "adding" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : libraryState === "added" ? (
                    <Check className="size-3.5" />
                  ) : (
                    <LibraryBig className="size-3.5" />
                  )}
                  {libraryState === "added" ? "Added" : "Add to library"}
                </button>
                <a
                  href={result.url}
                  download="text-to-speech"
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Download className="size-3.5" />
                  Download
                </a>
              </div>
            </div>
            <AudioPlayer src={result.url} accent={accentFor(result.url)} />
          </div>
        )}
      </div>

      {!signedOut && (
        <MediaGenerationHistory<AudioHistoryRow>
          basePath="audio-generations"
          listKey="generations"
          kind="audio"
          label={(row) => row.script}
          emptyMessage="Nothing saved to your account yet — a generated clip will show up here."
          onUseAgain={reuse}
          onAddToLibrary={(row) => void addHistoryEntryToLibrary(row)}
          variant="audio-card"
          subtitle={(row) => row.voice}
        />
      )}
    </div>
  );
}
