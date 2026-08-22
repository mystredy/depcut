"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Monitor, Ratio, Smartphone, Square } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditor } from "@/cut/lib/store";
import { useLocalPref } from "@/cut/lib/uiState";
import { ASPECT_PRESETS, aspectLabel, aspectOrientation, normalizeAspect, parseRatio, type Aspect } from "@/cut/lib/types";
import { cn } from "@/lib/utils";

function AspectIcon({ aspect, className }: { aspect: Aspect; className?: string }) {
  const o = aspectOrientation(aspect);
  const Icon = o === "square" ? Square : o === "landscape" ? Monitor : Smartphone;
  return <Icon className={className} />;
}

/** The project's aspect-ratio picker. Self-contained (reads/writes the
 * project's aspect directly). `variant="pill"` (default) is a compact pill
 * that opens a dropdown — the top bar's shape. `variant="list"` renders the
 * same presets and custom editor already expanded in place, for a panel with
 * room to spare. */
export function AspectRatioControl({ variant = "pill" }: { variant?: "pill" | "list" }) {
  const aspect = useEditor((s) => s.aspect);
  const isPreset = ASPECT_PRESETS.some((p) => p.value === aspect);
  // Custom is a sticky mode: picked from the menu, entered by typing in the pill,
  // or loading a project on a non-preset ratio, the pill stays a W:H editor until
  // a preset is chosen from its chevron menu. Sticky matters while typing — a
  // keystroke that lands on a preset value ("16:9") would otherwise flip
  // `isPreset` and unmount the editor out from under the cursor.
  const [customMode, setCustomMode] = useState(false);
  const showCustomEditor = customMode || !isPreset;
  // The last custom ratio survives preset detours and reloads: it's only
  // rewritten by a manual apply (or an external non-preset aspect), so
  // re-picking Custom… returns to it.
  // Remembered AS TYPED ("9.5:5"), so the pill re-shows the user's spelling
  // after reloads; the project doc always stores the reduced form ("19:10").
  const [savedCustom, setSavedCustom] = useLocalPref<string>(
    "cut-custom-aspect",
    "",
    (v) => typeof v === "string" && normalizeAspect(v) !== null
  );
  const [customW, setCustomW] = useState(() => savedCustom.split(":")[0] || "16");
  const [customH, setCustomH] = useState(() => savedCustom.split(":")[1] || "9");
  // Sides may be decimal ("1.85"); the applied/stored form is the reduced
  // whole-number ratio ("37:20").
  const customNormalized = normalizeAspect(`${customW}:${customH}`);
  // Hold the field to what normalizeAspect accepts — four whole digits, two
  // decimals — so a value can't type clean and then fail to apply. Four, so that
  // typing a frame size ("1280" by "720") is a legal entry that reduces to 16:9
  // rather than being trimmed to "128" and applied as a different ratio.
  const ratioInput = (v: string) => {
    const [whole, ...rest] = v.replace(/[^\d.]/g, "").split(".");
    const head = whole.slice(0, 4);
    return rest.length === 0 ? head : `${head}.${rest.join("").slice(0, 2)}`;
  };
  // A side mid-keystroke (empty, or a bare "1.") is unfinished rather than
  // wrong; only a settled pair that still won't normalize — a zero, or past the
  // 8:1 cap — reads as invalid, so the pill doesn't flash while someone types.
  const sideSettled = (v: string) => v !== "" && !v.endsWith(".");
  const customInvalid = sideSettled(customW) && sideSettled(customH) && !customNormalized;
  // Typing applies: a keystroke parks the pair it wants applied here, and the
  // effect below lands it a beat later, so the frame follows the fields instead
  // of waiting for a commit the user has to guess at. A newer keystroke replaces
  // the pending pair; settling, reverting, or an outside change clears it.
  const [pendingRatio, setPendingRatio] = useState<string | null>(null);
  const applyRatio = (ratio: string) => {
    const next = normalizeAspect(ratio);
    if (next) useEditor.getState().setAspect(next);
  };
  useEffect(() => {
    if (!pendingRatio) return;
    const id = setTimeout(() => {
      applyRatio(pendingRatio);
      setPendingRatio(null);
    }, 250);
    // Cancels on the next keystroke and on leaving the editor, so a ratio the
    // user moved past never lands.
    return () => clearTimeout(id);
  }, [pendingRatio]);

  // The inputs mirror aspect changes made outside the editor (AI set_aspect,
  // project load). Ours are recognised by the fields already normalizing to the
  // new value, so a live apply doesn't reformat what the user is typing.
  const [seenAspect, setSeenAspect] = useState(aspect);
  if (aspect !== seenAspect) {
    setSeenAspect(aspect);
    if (customNormalized !== aspect) {
      // The change came from outside: drop the pending keystroke so it can't land
      // a beat later and stomp it.
      setPendingRatio(null);
      const r = parseRatio(aspect);
      if (r && !ASPECT_PRESETS.some((p) => p.value === aspect)) {
        setCustomW(String(r.w));
        setCustomH(String(r.h));
      }
    }
  }

  // What Escape restores. Captured when an edit session starts rather than read
  // back from `savedCustom`, because live apply means the "last good" value is
  // whatever was typed a moment ago — Escape has to reach further back, to the
  // ratio the project had before the user touched the pill.
  const revertRef = useRef<{ w: string; h: string; aspect: Aspect } | null>(null);
  const beginEditing = () => {
    setCustomMode(true);
    revertRef.current ??= { w: customW, h: customH, aspect: useEditor.getState().aspect };
  };
  const revertCustom = () => {
    setPendingRatio(null);
    const snapshot = revertRef.current;
    revertRef.current = null;
    if (!snapshot) return;
    setCustomW(snapshot.w);
    setCustomH(snapshot.h);
    if (useEditor.getState().aspect !== snapshot.aspect) {
      useEditor.getState().setAspect(snapshot.aspect);
    }
  };
  // Leaving the pill ends the session. Whatever is typed has already been applied
  // live, so this only remembers the spelling and puts the fields back when they
  // hold something that never applied — the pill never sits showing a ratio the
  // project doesn't have.
  const endEditing = () => {
    revertRef.current = null;
    if (customNormalized) {
      setSavedCustom(`${customW}:${customH}`);
      return;
    }
    setPendingRatio(null);
    const r = parseRatio(useEditor.getState().aspect);
    if (r) {
      setCustomW(String(r.w));
      setCustomH(String(r.h));
    }
  };
  const commitCustom = () => {
    setPendingRatio(null);
    if (customNormalized) applyRatio(`${customW}:${customH}`);
    endEditing();
  };

  const selectPreset = (value: Aspect) => {
    useEditor.getState().setAspect(value);
    setCustomMode(false);
  };
  // Picking Custom returns to the remembered ratio right away.
  const selectCustom = () => {
    setCustomMode(true);
    if (customNormalized) useEditor.getState().setAspect(customNormalized);
  };
  const customLabel = normalizeAspect(savedCustom) ? `Custom · ${savedCustom}` : "Custom…";

  if (variant === "list") {
    return (
      <div className="flex w-full flex-col gap-0.5">
        {ASPECT_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => selectPreset(p.value)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
              !showCustomEditor && aspect === p.value && "bg-muted"
            )}
          >
            <AspectIcon aspect={p.value} className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">
              {p.name} · {p.value}
              {p.sublabel && (
                <span className="block text-[10.5px] text-muted-foreground">{p.sublabel}</span>
              )}
            </span>
            {!showCustomEditor && aspect === p.value && (
              <Check className="size-3.5 shrink-0 text-muted-foreground" />
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={selectCustom}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
            showCustomEditor && "bg-muted"
          )}
        >
          <Ratio className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">{customLabel}</span>
          {showCustomEditor && <Check className="size-3.5 shrink-0 text-muted-foreground" />}
        </button>
        {showCustomEditor && (
          <div
            className={cn(
              "mt-1 flex items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium",
              customInvalid ? "border-destructive text-destructive" : "border-border"
            )}
            title={customInvalid ? "Up to an 8:1 shape" : undefined}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) endEditing();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitCustom();
              if (e.key === "Escape") revertCustom();
            }}
          >
            <input
              aria-label="Width"
              aria-invalid={customInvalid}
              inputMode="decimal"
              className="w-10 bg-transparent text-center outline-none"
              value={customW}
              onFocus={beginEditing}
              onChange={(e) => {
                const v = ratioInput(e.target.value);
                setCustomW(v);
                setPendingRatio(`${v}:${customH}`);
              }}
            />
            <span className="text-muted-foreground">:</span>
            <input
              aria-label="Height"
              aria-invalid={customInvalid}
              inputMode="decimal"
              className="w-10 bg-transparent text-center outline-none"
              value={customH}
              onFocus={beginEditing}
              onChange={(e) => {
                const v = ratioInput(e.target.value);
                setCustomH(v);
                setPendingRatio(`${customW}:${v}`);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  const aspectMenu = (
    <DropdownMenuContent align="start" className="w-56">
      {ASPECT_PRESETS.map((p) => (
        <DropdownMenuItem key={p.value} onClick={() => selectPreset(p.value)}>
          <AspectIcon aspect={p.value} />
          <span className="flex-1">
            {p.name} · {p.value}
            {p.sublabel && (
              <span className="block text-[10.5px] text-muted-foreground">{p.sublabel}</span>
            )}
          </span>
          {!showCustomEditor && aspect === p.value && (
            <Check className="size-3.5 text-muted-foreground" />
          )}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem onClick={selectCustom}>
        <Ratio />
        <span className="flex-1">{customLabel}</span>
        {showCustomEditor && <Check className="size-3.5 text-muted-foreground" />}
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  return showCustomEditor ? (
    <div
      className={cn(
        "aspect-switch flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-xs",
        customInvalid ? "border-destructive text-destructive" : "border-border"
      )}
      title={customInvalid ? "Up to an 8:1 shape" : undefined}
      // The session ends when focus leaves the pill entirely. Moving
      // between the two fields (or to the chevron) stays inside it, so a
      // half-typed side is never settled out from under the user.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) endEditing();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitCustom();
        if (e.key === "Escape") revertCustom();
      }}
    >
      <Ratio className="size-3.5 text-muted-foreground" />
      <input
        aria-label="Width"
        aria-invalid={customInvalid}
        inputMode="decimal"
        className="w-10 bg-transparent text-center outline-none"
        value={customW}
        onFocus={beginEditing}
        onChange={(e) => {
          const v = ratioInput(e.target.value);
          setCustomW(v);
          setPendingRatio(`${v}:${customH}`);
        }}
      />
      <span className="text-muted-foreground">:</span>
      <input
        aria-label="Height"
        aria-invalid={customInvalid}
        inputMode="decimal"
        className="w-10 bg-transparent text-center outline-none"
        value={customH}
        onFocus={beginEditing}
        onChange={(e) => {
          const v = ratioInput(e.target.value);
          setCustomH(v);
          setPendingRatio(`${customW}:${v}`);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Aspect ratio presets"
          className="grid place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        {aspectMenu}
      </DropdownMenu>
    </div>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Aspect ratio: ${aspectLabel(aspect)}`}
        className="aspect-switch flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:text-foreground sm:px-3"
      >
        <AspectIcon aspect={aspect} className="size-3.5" />
        <span className="hidden sm:inline">{aspectLabel(aspect)}</span>
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      {aspectMenu}
    </DropdownMenu>
  );
}
