"use client";

import { type ComponentType } from "react";
import { ChevronDown, Frame, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoModelOption, VideoResolution } from "@/cut/lib/videoModels";
import type { VideoRefMode } from "@/cut/lib/videoGen";

// Shared knobs the video composers offer beyond model/aspect — the editor's
// Video tab and the dashboard's one-shot composer both render these from the
// same option sets and the same SegRow, so the two never drift apart.

export const REF_MODE_OPTIONS: {
  value: VideoRefMode;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { value: "frames", label: "Frames", icon: Frame },
  { value: "ingredients", label: "Ingredients", icon: Puzzle },
];

// Veo's set is confirmed against its published API (720p/1080p; 4, 6, or 8
// second clips). Omni's has no documented resolution or duration parameter
// at all — the request rides on the same best-effort, undocumented field its
// task already does (see gemini-omni-video.ts) and may simply be ignored.
export const RESOLUTION_OPTIONS: Record<
  VideoModelOption["provider"],
  { value: VideoResolution; label: string }[]
> = {
  "gemini-omni": [
    { value: "360p", label: "360p" },
    { value: "720p", label: "720p" },
  ],
  "gemini-veo": [
    { value: "720p", label: "720p" },
    { value: "1080p", label: "1080p" },
  ],
};

export const DURATION_OPTIONS: Record<
  VideoModelOption["provider"],
  { value: number; label: string }[]
> = {
  "gemini-omni": [
    { value: 4, label: "4s" },
    { value: 6, label: "6s" },
    { value: 8, label: "8s" },
    { value: 10, label: "10s" },
  ],
  "gemini-veo": [
    { value: 4, label: "4s" },
    { value: 6, label: "6s" },
    { value: 8, label: "8s" },
  ],
};

// Omni has no documented resolution or duration parameter (see
// RESOLUTION_OPTIONS/DURATION_OPTIONS above and gemini-omni-video.ts) — the
// picks above ride along as a best-effort, undocumented field the model may
// simply ignore. Shown under those two rows whenever the picked model is Omni.
export const OMNI_BEST_EFFORT_NOTE =
  "Omni decides resolution and clip length on its own — these are sent as a best-effort request, not a guarantee.";

export const COUNT_OPTIONS: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: "x1" },
  { value: 2, label: "x2" },
  { value: 3, label: "x3" },
  { value: 4, label: "x4" },
];

/** A row of equal-width segments — the aspect/resolution/duration/count knobs
 * below a video composer. One selected value, click to switch; an icon is
 * optional per option. */
export function SegRow<T extends string | number>({
  title,
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  title: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ComponentType<{ className?: string }> }[];
  disabled?: boolean;
  /** Override the container's width behavior — e.g. "flex-1" to stretch
   * beside a sibling instead of the default shrink-to-content. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 gap-1 rounded-lg bg-muted p-1",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      title={title}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.icon && <o.icon className="size-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A compact icon + text + chevron quick picker for a composer's bottom
 * toolbar — a borderless twin of PillSelect's hidden-native-select
 * technique, sized to sit inline among plain icon buttons instead of
 * standing out as a pill. */
export function IconSelect<T extends string>({
  icon: Icon,
  title,
  value,
  display,
  options,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: T;
  display: string;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label
      className="relative flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={title}
    >
      <Icon className="size-4 shrink-0" />
      <span className="max-w-16 truncate text-[11px] font-medium">{display}</span>
      <ChevronDown className="size-3 shrink-0" />
      <select
        className="absolute inset-0 w-full cursor-pointer appearance-none opacity-0"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A read-only icon + value chip for a knob that lives behind a composer's
 * "More settings" toggle — clicking it opens that panel rather than editing
 * the value inline. */
export function IconBadge({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-4 shrink-0" />
      <span className="text-[11px] font-medium">{value}</span>
    </button>
  );
}
