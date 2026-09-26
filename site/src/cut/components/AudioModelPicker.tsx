"use client";

import { useState } from "react";
import { AudioLines, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { AUDIO_MODELS, type AudioModel } from "@/cut/lib/audioModels";

/** Audio Model picker: DepCut's hosted Gemini voices, or ElevenLabs (Eleven v3
 * / Multilingual v2). Shared by every surface that generates a voiceover —
 * the ai-suite text-to-speech page and the editor's Audio panel — so the
 * choice reads and looks the same everywhere. */
export function AudioModelPicker({
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
        <DropdownMenuTrigger className="audio-model-select flex w-full items-center gap-2.5 rounded-lg border border-input bg-transparent px-2.5 py-2 text-left outline-none transition-colors focus:border-ring">
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
