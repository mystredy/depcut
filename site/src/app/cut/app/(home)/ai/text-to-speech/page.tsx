"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AudioLines,
  Check,
  ChevronDown,
  Download,
  Info,
  LibraryBig,
  Loader2,
  Play,
  Plus,
  Search,
  Square,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AudioPlayer } from "@/cut/components/AudioPlayer";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { MediaGenerationHistory } from "@/cut/components/MediaGenerationHistory";
import { ValueSlider } from "@/cut/components/ValueSlider";
import { useSpeakerVoice, useSpeechLanguage, VoicePicker } from "@/cut/components/VoicePicker";
import { AUDIO_MODELS, DEFAULT_AUDIO_MODEL, resolveAudioModel, type AudioModel } from "@/cut/lib/audioModels";
import { persistAudioGeneration } from "@/cut/lib/audioGenerationPersist";
import { accentFor } from "@/cut/lib/colorAccent";
import { DEFAULT_CREDIT_RATE, dollarsToCredits, type CreditRate } from "@/lib/credits/format-credits";
import { providerCreditPricing } from "@/lib/credits/provider-pricing";
import { usePublicSiteSettings } from "@/queries/site";
import { fetchElevenLabsVoices, type ElevenLabsVoice } from "@/cut/lib/elevenLabsVoices";
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

function ElevenLabsVoiceTag({ labels }: { labels?: Record<string, string> }) {
  const order = ["gender", "accent", "age", "use_case", "descriptive", "language"];
  const values = order.map((k) => labels?.[k]).filter((v): v is string => Boolean(v));
  if (values.length === 0) return null;
  return <span className="truncate text-muted-foreground">{values.join(" · ")}</span>;
}

/** A voice's avatar, colored deterministically from its id (see
 * colorAccent.ts) instead of a flat gray square. Doubles as its own preview
 * play/pause button when the voice has a hosted sample — works on tap, not
 * just hover — and falls back to a plain initial when it doesn't. */
function VoiceAvatarButton({
  voice,
  playing,
  onToggle,
  size = "size-8",
}: {
  voice: ElevenLabsVoice;
  playing: boolean;
  onToggle?: () => void;
  size?: string;
}) {
  const initial = voice.name.slice(0, 1).toUpperCase();
  if (!voice.previewUrl || !onToggle) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-md bg-gradient-to-br text-[12px] font-semibold text-white",
          size,
          accentFor(voice.id),
        )}
      >
        {initial}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={playing ? `Stop ${voice.name} preview` : `Play ${voice.name} preview`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "group grid shrink-0 place-items-center rounded-md bg-gradient-to-br text-white transition-transform active:scale-95",
        size,
        accentFor(voice.id),
      )}
    >
      {playing ? (
        <Square className="size-3 fill-current" />
      ) : (
        <>
          <Play className="ml-0.5 hidden size-3.5 fill-current group-hover:block" />
          <span className="text-[12px] font-semibold group-hover:hidden">{initial}</span>
        </>
      )}
    </button>
  );
}

/** Audio Model picker: DepCut's hosted Gemini voices, or ElevenLabs (Eleven v3
 * / Multilingual v2) once the account has an ElevenLabs voice picked. */
function AudioModelPicker({
  model,
  onChange,
}: {
  model: AudioModel;
  onChange: (m: AudioModel) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <SectionTitle>Audio model</SectionTitle>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg border border-input bg-transparent px-2.5 py-2 text-left outline-none transition-colors focus:border-ring">
          <AudioLines className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{model.label}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
          {AUDIO_MODELS.map((m) => (
            <DropdownMenuItem key={m.id} onClick={() => onChange(m)}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                  {m.label}
                  {m.badge && (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-600 dark:text-amber-400">
                      {m.badge}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">{m.description}</span>
              </div>
              {model.id === m.id && <Check className="size-3.5 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** ElevenLabs voice picker: the account's own catalog (fetched once, cached),
 * each entry showing its ElevenLabs labels (gender, accent, age, …) and a
 * hover-to-preview hosted sample — same interaction as the Gemini persona
 * picker, minus the portrait grid. */
function ElevenLabsVoicePicker({
  voiceId,
  onChange,
  onError,
}: {
  voiceId: string | null;
  onChange: (voice: ElevenLabsVoice) => void;
  onError: (e: unknown) => void;
}) {
  const [voices, setVoices] = useState<ElevenLabsVoice[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addResults, setAddResults] = useState<ElevenLabsVoice[] | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchElevenLabsVoices()
      .then((v) => {
        if (!cancelled) setVoices(v);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(true);
        onError(e);
      });
    return () => {
      cancelled = true;
    };
    // onError is a stable callback from the parent's setError setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => audio.current?.pause(), []);

  // The first voice becomes the pick once the catalog loads and nothing is
  // selected yet — the account always has at least its premade voices.
  useEffect(() => {
    if (voices && voices.length > 0 && !voiceId) onChange(voices[0]);
  }, [voices, voiceId, onChange]);

  const selected = voices?.find((v) => v.id === voiceId);

  // Hovering a row still previews it (mouse users), and the row's own play
  // button now does the same on click (works without a hover, e.g. touch) —
  // both go through this one Audio element, so starting either stops
  // whatever was already playing.
  const preview = (v: ElevenLabsVoice) => {
    if (!v.previewUrl) return;
    const el = (audio.current ??= new Audio());
    el.onplay = () => setPlayingId(v.id);
    el.onpause = () => setPlayingId((id) => (id === v.id ? null : id));
    el.onended = () => setPlayingId((id) => (id === v.id ? null : id));
    el.src = v.previewUrl;
    el.currentTime = 0;
    void el.play().catch(() => {});
  };
  const leave = () => audio.current?.pause();
  const togglePreview = (v: ElevenLabsVoice) => {
    if (playingId === v.id) {
      audio.current?.pause();
    } else {
      preview(v);
    }
  };

  const filtered = (voices ?? []).filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const haystack = [v.name, ...(v.labels ? Object.values(v.labels) : [])].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
    const q = addQuery.trim();
    if (!q) return;
    setAddBusy(true);
    setAddError(null);
    setAddResults(null);
    try {
      setAddResults(await fetchElevenLabsVoices(q));
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setAddBusy(false);
    }
  };

  // Picking a search/id result adds it to this picker's own list (so it
  // shows up selected and stays available to reselect) without touching the
  // ElevenLabs account itself — any voice id the API accepts works for
  // generation whether or not it's been added to the account's library.
  const selectAdded = (v: ElevenLabsVoice) => {
    setVoices((prev) => [v, ...(prev ?? []).filter((existing) => existing.id !== v.id)]);
    onChange(v);
    setAdding(false);
    setAddQuery("");
    setAddResults(null);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <SectionTitle>Voice</SectionTitle>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) audio.current?.pause();
        }}
      >
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-2 text-left outline-none transition-colors focus:border-ring disabled:opacity-60">
          {voices === null ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : selected ? (
            <VoiceAvatarButton voice={selected} playing={false} size="size-7" />
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold">
              ?
            </span>
          )}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[12.5px] font-semibold">
              {loadError ? "Couldn't load voices" : (selected?.name ?? "Choose a voice")}
            </span>
            {selected && <ElevenLabsVoiceTag labels={selected.labels} />}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-96 max-w-[calc(100vw-2rem)] p-0">
          <div className="flex items-center gap-1.5 border-b p-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voice"
                className="w-full rounded-full border border-input bg-transparent py-1.5 pr-7 pl-8 text-[12px] outline-none focus:border-ring"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Add a voice by id or name"
              title="Add a voice by id or name"
              onClick={() => setAdding((a) => !a)}
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
                adding
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Plus className="size-4" />
            </button>
          </div>

          {adding && (
            <div className="flex flex-col gap-1.5 border-b p-2">
              <form onSubmit={(e) => void submitAdd(e)} className="flex gap-1.5">
                <input
                  autoFocus
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  placeholder="Voice ID or name"
                  className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 py-1.5 text-[12px] outline-none focus:border-ring"
                />
                <Button type="submit" size="sm" disabled={addBusy || !addQuery.trim()}>
                  {addBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
                </Button>
              </form>
              {addError && <p className="text-[11px] text-destructive">{addError}</p>}
              {addResults && (
                <div className="flex max-h-40 flex-col gap-0.5 overflow-auto">
                  {addResults.map((v) => (
                    <div
                      key={v.id}
                      role="button"
                      tabIndex={0}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted"
                      onClick={() => selectAdded(v)}
                      onKeyDown={(e) => e.key === "Enter" && selectAdded(v)}
                      onMouseEnter={() => preview(v)}
                      onMouseLeave={leave}
                    >
                      <VoiceAvatarButton
                        voice={v}
                        size="size-6"
                        playing={playingId === v.id}
                        onToggle={() => togglePreview(v)}
                      />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[11.5px] font-medium">{v.name}</span>
                        <span className="flex gap-1 truncate text-[10px]">
                          <ElevenLabsVoiceTag labels={v.labels} />
                        </span>
                      </span>
                    </div>
                  ))}
                  {addResults.length === 0 && (
                    <p className="p-1.5 text-[11px] text-muted-foreground">No matches for that id or name.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <ScrollArea className="max-h-80">
            <div className="p-1">
              {filtered.map((v) => (
                <div
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  onClick={() => {
                    onChange(v);
                    setOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onChange(v);
                      setOpen(false);
                    }
                  }}
                  onMouseEnter={() => preview(v)}
                  onMouseLeave={leave}
                >
                  <VoiceAvatarButton
                    voice={v}
                    playing={playingId === v.id}
                    onToggle={() => togglePreview(v)}
                  />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[12px] font-medium">{v.name}</span>
                    <span className="flex gap-1 truncate text-[10.5px]">
                      <ElevenLabsVoiceTag labels={v.labels} />
                    </span>
                  </span>
                  {v.id === voiceId && <Check className="size-3.5 shrink-0" />}
                </div>
              ))}
              {voices?.length === 0 && (
                <p className="p-2 text-[11px] text-muted-foreground">No voices on this account yet.</p>
              )}
              {voices && voices.length > 0 && filtered.length === 0 && (
                <p className="p-2 text-[11px] text-muted-foreground">No voices match &quot;{search}&quot;.</p>
              )}
            </div>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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
