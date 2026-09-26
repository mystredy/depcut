"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Loader2, Play, Plus, Search, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { accentFor } from "@/cut/lib/colorAccent";
import { fetchElevenLabsVoices, type ElevenLabsVoice } from "@/cut/lib/elevenLabsVoices";
import { cn } from "@/lib/utils";

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

/** ElevenLabs voice picker: the account's own catalog (fetched once, cached),
 * each entry showing its ElevenLabs labels (gender, accent, age, …) and a
 * hover-to-preview hosted sample — same interaction as the Gemini persona
 * picker (VoicePicker.tsx), minus the portrait grid. Shared by every surface
 * that generates an ElevenLabs voiceover. */
export function ElevenLabsVoicePicker({
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
        <DropdownMenuTrigger className="elevenlabs-voice-select flex w-full items-center gap-2.5 overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-2 text-left outline-none transition-colors focus:border-ring disabled:opacity-60">
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
