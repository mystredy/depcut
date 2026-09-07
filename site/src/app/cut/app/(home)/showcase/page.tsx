"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play, Search, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCutBase } from "@/cut/lib/nav";
import { useCategories } from "@/queries/categories";
import { cn } from "@/lib/utils";

type Aspect = "16:9" | "9:16" | "1:1";
type AspectFilter = "all" | Aspect;
type SortOption = "newest" | "popular";

type ShowcaseItem = {
  id: string;
  title: string;
  creator: string;
  category: string;
  aspect: Aspect;
  duration: number;
  views: number;
  prompt: string;
  gradient: [string, string];
};

// No showcase backend exists yet (no public-project submission or feed
// table) — same situation Creator Hub's Inspiration board was in, so this
// follows its pattern: a local seed list standing in for what a real feed
// would serve, with real filter/search/sort logic against it. Category
// names are the real marketplace taxonomy (useCategories), not invented.
const SEED_ITEMS: ShowcaseItem[] = [
  {
    id: "1",
    title: "Paris in the rain, watercolor style",
    creator: "Elena R.",
    category: "Entertainment",
    aspect: "9:16",
    duration: 14,
    views: 8200,
    prompt:
      "A rainy evening street in Paris, watercolor painting style, warm cafe lights reflecting on wet cobblestones, a woman in a trench coat crossing the street, Eiffel Tower soft-focus in the background.",
    gradient: ["#f2b8a2", "#b8493c"],
  },
  {
    id: "2",
    title: "Product teaser — orbiting device render",
    creator: "Marcus T.",
    category: "Technology",
    aspect: "16:9",
    duration: 22,
    views: 15400,
    prompt: "A minimalist tech product slowly rotating on a pedestal, studio lighting, soft reflections, clean gradient backdrop.",
    gradient: ["#c9d9ea", "#47688c"],
  },
  {
    id: "3",
    title: "Pour-over coffee, slow motion",
    creator: "Nadia K.",
    category: "Entertainment",
    aspect: "1:1",
    duration: 8,
    views: 3100,
    prompt: "Slow-motion pour-over coffee, steam rising, warm morning light, close-up macro shot.",
    gradient: ["#f6dca0", "#a9762a"],
  },
  {
    id: "4",
    title: "\"Wait, you have to try this\" — hook",
    creator: "Jae P.",
    category: "Entertainment",
    aspect: "9:16",
    duration: 19,
    views: 42300,
    prompt: "A casual selfie video, tight close-up, talking mid-conversation, candid handheld energy, UGC style.",
    gradient: ["#3a3532", "#0f0e0d"],
  },
  {
    id: "5",
    title: "Fog rolling over the pine ridge",
    creator: "Tomas V.",
    category: "Education",
    aspect: "16:9",
    duration: 31,
    views: 5600,
    prompt: "Aerial drone shot of fog rolling over a pine forest ridge at dawn, cinematic wide shot.",
    gradient: ["#cfe0c4", "#56753e"],
  },
  {
    id: "6",
    title: "Quarterly recap, clean and minimal",
    creator: "Priya S.",
    category: "Finance & Business",
    aspect: "1:1",
    duration: 12,
    views: 2200,
    prompt: "A clean, minimal business recap video with animated charts and soft neutral tones.",
    gradient: ["#d8cfe6", "#6f5799"],
  },
  {
    id: "7",
    title: "Neon alley, night walk",
    creator: "Owen L.",
    category: "Entertainment",
    aspect: "9:16",
    duration: 17,
    views: 9800,
    prompt: "Walking through a neon-lit alley at night, reflections on wet pavement, moody cyberpunk color grade.",
    gradient: ["#f6dca0", "#a9762a"],
  },
  {
    id: "8",
    title: "Rooftop sunset, hand-drawn look",
    creator: "Hana M.",
    category: "Music",
    aspect: "16:9",
    duration: 26,
    views: 12700,
    prompt: "A rooftop at sunset, hand-drawn anime style, warm gradient sky, wind moving through hair and clothing.",
    gradient: ["#f2b8a2", "#b8493c"],
  },
  {
    id: "9",
    title: "Otter cam, close-up grooming",
    creator: "Sofia D.",
    category: "Education",
    aspect: "9:16",
    duration: 9,
    views: 31200,
    prompt: "A close-up nature-documentary shot of an otter grooming itself on a riverbank, shallow depth of field.",
    gradient: ["#c9d9ea", "#47688c"],
  },
  {
    id: "10",
    title: "Desert dunes, golden hour",
    creator: "Idris W.",
    category: "Education",
    aspect: "1:1",
    duration: 15,
    views: 4400,
    prompt: "Wide shot of desert dunes at golden hour, long shadows, warm sand tones, minimal composition.",
    gradient: ["#cfe0c4", "#56753e"],
  },
  {
    id: "11",
    title: "Venice canals, dawn boat pass",
    creator: "Clara B.",
    category: "Entertainment",
    aspect: "16:9",
    duration: 24,
    views: 6700,
    prompt: "A gondola passing through a quiet Venice canal at dawn, soft mist, warm building facades reflected in the water.",
    gradient: ["#d8cfe6", "#6f5799"],
  },
  {
    id: "12",
    title: "App walkthrough, snappy cuts",
    creator: "Ren A.",
    category: "AI",
    aspect: "9:16",
    duration: 20,
    views: 18900,
    prompt: "A fast-paced app walkthrough with snappy screen-recording cuts and bold on-screen captions.",
    gradient: ["#3a3532", "#0f0e0d"],
  },
];

const ASPECT_FILTERS: { value: AspectFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "16:9", label: "Landscape" },
  { value: "9:16", label: "Vertical" },
  { value: "1:1", label: "Square" },
];

const ASPECT_CLASS: Record<Aspect, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
};

function formatDuration(seconds: number): string {
  return `0:${String(Math.round(seconds)).padStart(2, "0")}`;
}

function formatViews(views: number): string {
  return views >= 1000 ? `${(views / 1000).toFixed(views % 1000 === 0 ? 0 : 1)}k` : String(views);
}

export default function ShowcasePage() {
  const base = useCutBase();
  const categoriesQuery = useCategories();
  const [search, setSearch] = useState("");
  const [aspectFilter, setAspectFilter] = useState<AspectFilter>("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selected, setSelected] = useState<ShowcaseItem | null>(null);

  const items = useMemo(() => {
    const filtered = SEED_ITEMS.filter((item) => {
      if (aspectFilter !== "all" && item.aspect !== aspectFilter) return false;
      if (category !== "all" && item.category !== category) return false;
      if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return sort === "popular" ? [...filtered].sort((a, b) => b.views - a.views) : filtered;
  }, [aspectFilter, category, search, sort]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Showcase</h1>
        <p className="mt-1 text-sm text-muted-foreground">What people are making with DepCut.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex w-full items-center gap-2 rounded-lg border border-input px-2.5 py-1.5 focus-within:border-ring sm:w-56">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="flex rounded-lg border border-input p-0.5">
          {ASPECT_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setAspectFilter(f.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                aspectFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoriesQuery.data?.categories.map((c) => (
              <SelectItem key={c.id} value={c.name}>
                {c.emoji} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Sort: Newest</SelectItem>
            <SelectItem value="popular">Sort: Popular</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">{items.length} projects</span>
      </div>

      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="group mb-5 block w-full break-inside-avoid text-left"
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border transition-shadow group-hover:shadow-[0_6px_28px_rgba(0,0,0,0.14)]",
                ASPECT_CLASS[item.aspect]
              )}
              style={{ background: `linear-gradient(160deg, ${item.gradient[0]}, ${item.gradient[1]})` }}
            >
              <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
                {item.category}
              </span>
              <span className="absolute right-2 bottom-2 rounded-[5px] bg-black/65 px-1.5 py-px font-mono text-[10.5px] text-white tabular-nums">
                {formatDuration(item.duration)}
              </span>
              <div className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/20">
                <span className="grid size-11 scale-90 place-items-center rounded-full bg-white/95 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100">
                  <Play className="ml-0.5 size-4 fill-ink text-ink" />
                </span>
              </div>
            </div>
            <div className="mt-2 px-0.5">
              <p className="text-[13px] leading-snug font-semibold group-hover:text-coral">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">by {item.creator}</p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <div className="flex flex-col sm:flex-row">
              <div
                className={cn(
                  "relative flex shrink-0 items-center justify-center bg-ink sm:w-2/5",
                  selected.aspect === "9:16" ? "aspect-[9/16]" : "aspect-video sm:aspect-auto"
                )}
                style={{ background: `linear-gradient(160deg, ${selected.gradient[0]}, ${selected.gradient[1]})` }}
              >
                <span className="grid size-14 place-items-center rounded-full bg-white/95">
                  <Play className="ml-0.5 size-5 fill-ink text-ink" />
                </span>
                <span className="absolute bottom-3 left-3 rounded-full bg-black/30 px-2 py-0.5 font-mono text-[11px] text-white">
                  {formatDuration(selected.duration)}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col p-6">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold">
                    {selected.category}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold">
                    {selected.aspect}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold">
                    {formatViews(selected.views)} views
                  </span>
                </div>

                <h2 className="mt-3 text-lg leading-snug font-semibold">{selected.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">by {selected.creator} · made with DepCut</p>

                <p className="mt-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Prompt</p>
                <p className="mt-1.5 rounded-lg bg-muted p-3 text-[13px] leading-relaxed">{selected.prompt}</p>

                <div className="mt-auto pt-6">
                  <Button
                    className="w-full"
                    nativeButton={false}
                    render={<Link href={`${base}/projects`} />}
                  >
                    <Wand2 data-icon="inline-start" />
                    Open in editor
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
