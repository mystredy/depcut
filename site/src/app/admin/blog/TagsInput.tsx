"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
};

// A chip input for a post's labels — type a label, press Enter or "," to add
// it as a chip, Backspace on an empty draft removes the last one. Shared by
// the editor's post-settings dialog and the list row's quick-tag popover.
export function TagsInput({ value, onChange, placeholder, className }: Props) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const label = draft.trim();
    setDraft("");
    if (!label) return;
    if (value.some((tag) => tag.toLowerCase() === label.toLowerCase())) return;
    onChange([...value, label]);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5",
        className,
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="min-w-[80px] flex-1 border-0 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
