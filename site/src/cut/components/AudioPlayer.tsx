"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const BAR_COUNT = 56;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Downsamples the clip's PCM data into BAR_COUNT peaks for the waveform. Runs
// once per src; falls back to null (a plain scrub bar) for anything the
// browser can't decode.
function useWaveform(src: string): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    setPeaks(null);
    let cancelled = false;
    (async () => {
      try {
        const buffer = await fetch(src).then((r) => r.arrayBuffer());
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextCtor();
        const decoded = await ctx.decodeAudioData(buffer);
        const channel = decoded.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(channel.length / BAR_COUNT));
        const values: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) sum += Math.abs(channel[start + j] ?? 0);
          values.push(sum / blockSize);
        }
        const max = Math.max(...values, 0.0001);
        void ctx.close();
        if (!cancelled) setPeaks(values.map((v) => v / max));
      } catch {
        if (!cancelled) setPeaks(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return peaks;
}

// A styled play/pause + waveform scrubber for a generated clip, in place of
// the browser's bare <audio controls>.
export function AudioPlayer({ src, className }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const peaks = useWaveform(src);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
    setPlaying(!playing);
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  const progress = duration > 0 ? current / duration : 0;

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-muted/30 p-3", className)}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- generated speech has no separate caption track */}
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
      >
        {playing ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="ml-0.5 size-4 fill-current" />
        )}
      </button>

      <div className="min-w-0 flex-1 space-y-1.5">
        {peaks ? (
          <button
            type="button"
            aria-label="Seek"
            className="flex h-8 w-full items-center gap-[2px]"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seek(Math.min(1, Math.max(0, ratio)) * duration);
            }}
          >
            {peaks.map((v, i) => (
              <span
                key={i}
                className={cn(
                  "min-h-[3px] flex-1 rounded-full transition-colors",
                  i / BAR_COUNT < progress ? "bg-primary" : "bg-muted-foreground/25",
                )}
                style={{ height: `${Math.max(v * 100, 10)}%` }}
              />
            ))}
          </button>
        ) : (
          <Slider
            aria-label="Seek"
            value={current}
            max={duration || 1}
            step={0.01}
            onValueChange={(value) => seek(Array.isArray(value) ? value[0] : value)}
          />
        )}
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
