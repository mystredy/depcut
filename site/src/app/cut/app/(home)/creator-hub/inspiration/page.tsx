"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle,
  Clock,
  Compass,
  Filter,
  Search,
  Video,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { useCutBase } from "@/cut/lib/nav";
import { useCategories } from "@/queries/categories";
import { useCreateDraftSubmission } from "@/queries/submissions";
import { cn } from "@/lib/utils";

type TaskStatus = "available" | "taken" | "completed";
type TaskCategory = string;

type Task = {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  niche?: string;
  status: TaskStatus;
  maxRates: number;
  shortClip?: string;
  instructions?: string;
  script?: string;
  hoursToComplete?: number;
  claimedBy?: string;
  claimedAt?: string;
  requiredArtists?: string[];
  reviewedAt?: string;
};

type SubmissionStatus = "submitted" | "Approved" | "Rejected";
type ReviewStatus = "Pending" | "Qualified" | "Rejected";

type Submission = {
  taskId: string;
  status: SubmissionStatus;
  reviewStatus?: ReviewStatus;
};

type SortOption = "default" | "rates-desc" | "limit-asc";

// No task marketplace backend exists yet — tasks and submissions are seeded
// locally, and claiming one only updates this component's own state. Their
// categories match names from the real Category table (see
// src/lib/marketplace/categories-seed.ts) so the category filter still works.
const SEED_TASKS: Task[] = [
  {
    id: "task-0",
    title: "Recreate this whip-pan travel montage",
    description:
      "Match the pacing and whip-pan transitions from the reference clip using your own b-roll.",
    category: "Travel",
    status: "available",
    maxRates: 8,
    instructions: "Cut on the beat, keep each shot under 1.5s, end on a wide establishing shot.",
    hoursToComplete: 12,
  },
  {
    id: "task-1",
    title: "AI Shorts hook: first 3 seconds",
    description: "Build a 3-second cold-open hook designed to stop the scroll on a vertical short.",
    category: "Social Media",
    niche: "Hook",
    status: "available",
    maxRates: 5,
    hoursToComplete: 6,
  },
  {
    id: "task-2",
    title: "Kinetic typography lyric snippet",
    description: "Animate the provided lyric line with kinetic typography matching the reference energy.",
    category: "Creative",
    status: "available",
    maxRates: 10,
    script: '"Every sunrise is a second chance."',
    hoursToComplete: 24,
  },
  {
    id: "task-3",
    title: "Social cutdown: 60s to 15s",
    description: "Trim the source video into a 15-second vertical cutdown for Stories/Reels.",
    category: "Social Media",
    status: "available",
    maxRates: 4,
    hoursToComplete: 8,
  },
];

export default function InspirationPage() {
  const router = useRouter();
  const base = useCutBase();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? "";

  const categoriesQuery = useCategories();
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [submissions] = useState<Submission[]>([]);
  const [marketplaceMode, setMarketplaceMode] = useState<"public" | "mytasks">("public");
  const [myTasksSubFilter, setMyTasksSubFilter] = useState<"all" | "active" | "completed">("active");
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [showUnavailable, setShowUnavailable] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [toastIsError, setToastIsError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Live timer tick trigger, so the remaining-time strings below count down.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const categories = useMemo(
    () => [
      { name: "All", emoji: "" },
      ...(categoriesQuery.data?.categories.map((c) => ({ name: c.name, emoji: c.emoji })) ?? []),
    ],
    [categoriesQuery.data]
  );

  const isTaskCompleted = (t: Task) => {
    if (t.status === "completed") return true;
    const sub = submissions.find((s) => s.taskId === t.id && s.status !== "Rejected");
    if (sub && (sub.reviewStatus === "Qualified" || sub.status === "Approved")) {
      return true;
    }
    return false;
  };

  const createDraft = useCreateDraftSubmission();
  const goToSubmit = () => {
    createDraft.mutate(undefined, {
      onSuccess: (data) => router.push(`${base}/creator-hub/submit-project/${data.submission.id}`),
      onError: (error) => {
        setToastIsError(true);
        setToastMessage(error instanceof Error ? error.message : "Couldn't start a new submission.");
        setTimeout(() => setToastMessage(""), 6000);
      },
    });
  };

  const handleClaim = (id: string, title: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "taken", claimedBy: userId, claimedAt: new Date().toISOString() }
          : t
      )
    );
    setToastIsError(false);
    setToastMessage(`Task claimed: "${title}". You can submit project edits on the project submission portal!`);
    setTimeout(() => setToastMessage(""), 6000);
  };

  // Filter & Sort Logic
  const filteredAndSortedTasks = tasks
    .filter((task) => {
      // Tab filter
      if (marketplaceMode === "public") {
        if (task.status !== "available") {
          return false;
        }
      }
      if (marketplaceMode === "mytasks") {
        const isMyTask = task.claimedBy === userId;
        if (!isMyTask) {
          return false;
        }
        const completed = isTaskCompleted(task);
        if (myTasksSubFilter === "active" && completed) {
          return false;
        }
        if (myTasksSubFilter === "completed" && !completed) {
          return false;
        }
      }

      // Category filter
      const matchesCategory = selectedCategory === "All" || task.category === selectedCategory;

      // Search filter
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "rates-desc") {
        return b.maxRates - a.maxRates;
      }
      if (sortBy === "limit-asc") {
        return (a.hoursToComplete || 12) - (b.hoursToComplete || 12);
      }
      return 0; // "default" - no sorting
    });

  const remixCount = tasks.filter((t) => t.claimedBy === userId && !isTaskCompleted(t)).length;

  return (
    <div className="space-y-6 p-6" id="marketplace-view">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-50 flex max-w-sm items-center gap-3.5 rounded-2xl border bg-card p-5 text-xs shadow-2xl">
          {toastIsError ? (
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle className="size-5 shrink-0 text-emerald-500" />
          )}
          <div className="space-y-1.5 text-left">
            <div className="font-medium text-foreground leading-normal">{toastMessage}</div>
            {!toastIsError && (
              <button
                onClick={goToSubmit}
                className="mt-1 block cursor-pointer border-0 bg-transparent p-0 text-left font-bold text-primary underline hover:text-primary/80"
              >
                Go to Submission Center →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab Switcher: Public Inspiration vs My Tasks */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-2xl border bg-muted/40 p-1">
          {(
            [
              { key: "public", label: "Inspirations", icon: Compass },
              { key: "mytasks", label: "Remixes", icon: Clock },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMarketplaceMode(key);
                if (key === "mytasks") setMyTasksSubFilter("active");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors",
                marketplaceMode === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
              {key === "mytasks" && remixCount > 0 && (
                <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-bold">
                  {remixCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter & Search Input Row */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="size-3.5" data-icon="inline-start" />
            Filters
          </Button>
          <label className="flex w-full items-center gap-2 rounded-lg border border-input px-2.5 py-1.5 focus-within:border-ring sm:w-60">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active Inspirations..."
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      </div>

      {marketplaceMode === "public" ? (
        <>
          {/* Advanced Filter, Sort & Category Controls */}
          {showFilters && (
            <div className="space-y-4 rounded-2xl border bg-card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Category Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={cn(
                        "shrink-0 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                        selectedCategory === cat.name
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      )}
                    >
                      {cat.emoji ? `${cat.emoji} ` : ""}
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Sort & Settings Options */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Toggle show completed */}
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={showUnavailable}
                      onChange={(e) => setShowUnavailable(e.target.checked)}
                      className="size-3.5 cursor-pointer accent-primary"
                    />
                    <span>Show Claimed/Completed</span>
                  </label>

                  <div className="hidden h-4 w-px bg-border md:block" />

                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowUpDown className="size-3.5 text-primary" />
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                      <SelectTrigger className="h-8 w-[190px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default order</SelectItem>
                        <SelectItem value="rates-desc">Rates: high to low</SelectItem>
                        <SelectItem value="limit-asc">Time: shortest limit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Catalog Index Stream */}
          <div id="marketplace-active-campaigns-list-card" className="space-y-6">
            <div>
              <h3 className="text-base font-semibold">
                Active Inspirations ({filteredAndSortedTasks.length} total)
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Monitor live clip criteria posted to creators. Claim active sandbox jobs to submit
                your clips.
              </p>
            </div>

            <div className="space-y-4">
              {filteredAndSortedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-5 text-left transition-colors hover:border-primary/30"
                >
                  <div className="space-y-2.5">
                    {/* Category, Niche & Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-purple-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-purple-700 uppercase dark:text-purple-400">
                        {task.category}
                      </span>
                      {task.niche && (
                        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary uppercase">
                          🎯 {task.niche}
                        </span>
                      )}
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700 uppercase dark:text-emerald-400">
                        {task.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex flex-col items-start gap-5 sm:flex-row">
                      {/* Media Preview/Thumbnail */}
                      <div className="relative flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted xs:h-36 xs:w-24">
                        {task.shortClip ? (
                          task.shortClip.toLowerCase().endsWith(".mp4") ||
                          task.shortClip.toLowerCase().includes("video") ? (
                            <video
                              src={task.shortClip}
                              muted
                              loop
                              playsInline
                              autoPlay
                              className="size-full object-cover"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element -- external inspiration thumbnail, not a Next asset
                            <img
                              src={task.shortClip}
                              alt="Inspiration Thumbnail"
                              className="size-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.src =
                                  "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=200&auto=format&fit=crop";
                              }}
                            />
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center">
                            <Video className="mb-1 size-5 text-muted-foreground" />
                            <span className="font-mono text-[7px] font-bold tracking-widest text-muted-foreground uppercase">
                              No media
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        {/* Title */}
                        <h4 className="text-base font-semibold">{task.title}</h4>

                        {/* Description */}
                        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                          {task.description}
                        </p>

                        {/* Instructions */}
                        {(task.instructions || task.script) && (
                          <div className="mt-2 space-y-1.5 rounded-xl border bg-background p-3">
                            <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                              📋 Instructions & Guidelines
                            </span>
                            {task.instructions && (
                              <p className="text-xs leading-relaxed">{task.instructions}</p>
                            )}
                            {task.script && (
                              <p className="text-xs leading-relaxed">
                                <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">
                                  Script:
                                </span>{" "}
                                {task.script}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Reward & Action */}
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="flex w-fit items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-2.5">
                            <span className="text-sm">⭐</span>
                            <div className="text-xs font-semibold">
                              Max Rates:{" "}
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {task.maxRates}
                              </span>{" "}
                              <span className="text-[10px] font-normal text-muted-foreground">
                                ({`⭐ Earn up to ${task.maxRates} Rates`})
                              </span>
                            </div>
                          </div>

                          {task.status === "available" ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => handleClaim(task.id, task.title)}>
                              Remix
                            </Button>
                          ) : task.status === "taken" ? (
                            <Button type="button" size="sm" onClick={goToSubmit}>
                              Submit Clip
                            </Button>
                          ) : (
                            <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 font-mono text-xs font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
                              COMPLETED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredAndSortedTasks.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No active inspirations match your query. Try a different tab or adjust filters.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Catalog Index Stream for claimed items */}
          <div
            className="space-y-6 rounded-3xl border bg-card p-6"
            id="marketplace-my-tasks-list"
          >
            <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-left">
                <h3 className="text-base font-semibold">
                  My Claims Directory ({filteredAndSortedTasks.length})
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Complete active edits or track your completed inspirations.
                </p>
              </div>

              {/* Sub-filtering tabs inside My Tasks directory */}
              <div className="flex shrink-0 self-start rounded-xl border bg-muted/40 p-1 sm:self-auto">
                {(
                  [
                    { key: "all", label: "All", count: tasks.filter((t) => t.claimedBy === userId).length },
                    {
                      key: "active",
                      label: "Active",
                      count: tasks.filter((t) => t.claimedBy === userId && !isTaskCompleted(t)).length,
                    },
                    {
                      key: "completed",
                      label: "Completed",
                      count: tasks.filter((t) => t.claimedBy === userId && isTaskCompleted(t)).length,
                    },
                  ] as const
                ).map(({ key, label, count }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMyTasksSubFilter(key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] font-bold uppercase transition-colors",
                      myTasksSubFilter === key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredAndSortedTasks.map((task) => {
                // Determine if a submission exists (prefer taskId match)
                const taskSub = submissions.find((s) => s.taskId === task.id && s.status !== "Rejected");
                const taskSubReviewLabel = taskSub
                  ? taskSub.reviewStatus
                    ? taskSub.reviewStatus
                    : taskSub.status === "submitted"
                      ? "Pending"
                      : taskSub.status
                  : null;

                // Calculate time remaining values
                const hoursLimit = task.hoursToComplete || 12;
                const limitMs = hoursLimit * 3600 * 1000;
                const claimedMs = task.claimedAt ? new Date(task.claimedAt).getTime() : Date.now();
                const elapsedMs = Date.now() - claimedMs;
                const remainingMs = limitMs - elapsedMs;

                const percentElapsed = Math.max(0, Math.min(100, (elapsedMs / limitMs) * 100));

                let remainingStr = "Calculating...";
                if (taskSub) {
                  remainingStr = "Submitted & Under Review";
                } else if (remainingMs <= 0) {
                  remainingStr = "Expired";
                } else {
                  const totalSecs = Math.floor(remainingMs / 1000);
                  const secs = totalSecs % 60;
                  const totalMins = Math.floor(totalSecs / 60);
                  const mins = totalMins % 60;
                  const hours = Math.floor(totalMins / 60);
                  remainingStr = `${hours}h ${mins}m ${secs}s remaining`;
                }

                // Determine bar color
                let barColor = "bg-emerald-500";
                if (percentElapsed > 85) {
                  barColor = "bg-rose-500";
                } else if (percentElapsed > 60) {
                  barColor = "bg-amber-500";
                } else if (percentElapsed > 35) {
                  barColor = "bg-yellow-500";
                }

                return (
                  <div
                    key={task.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border bg-muted/20 p-5 text-left"
                  >
                    <div className="space-y-3">
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between gap-2 border-b pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-purple-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-purple-700 uppercase dark:text-purple-400">
                            {task.category}
                          </span>
                          {task.niche && (
                            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary uppercase">
                              🎯 {task.niche}
                            </span>
                          )}
                        </div>

                        {isTaskCompleted(task) ? (
                          <span className="flex items-center gap-1.5 rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700 uppercase dark:text-emerald-400">
                            <CheckCircle className="size-3" />
                            Approved & completed
                          </span>
                        ) : taskSub ? (
                          <span className="flex items-center gap-1.5 rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-700 uppercase dark:text-cyan-400">
                            <span className="size-1.5 rounded-full bg-cyan-500" />
                            {taskSubReviewLabel
                              ? taskSubReviewLabel.toUpperCase()
                              : (taskSub.status || "SUBMITTED").toUpperCase()}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-amber-700 uppercase dark:text-amber-400">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            Remix in progress
                          </span>
                        )}
                      </div>

                      {/* Content details */}
                      <div className="flex items-start gap-4">
                        {/* Compact media preview */}
                        <div className="relative flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                          {task.shortClip ? (
                            task.shortClip.toLowerCase().endsWith(".mp4") ||
                            task.shortClip.toLowerCase().includes("video") ? (
                              <video
                                src={task.shortClip}
                                muted
                                loop
                                playsInline
                                autoPlay
                                className="size-full object-cover"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element -- external inspiration thumbnail, not a Next asset
                              <img
                                src={task.shortClip}
                                alt="Inspiration Thumbnail"
                                className="size-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            )
                          ) : (
                            <Video className="size-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <h4 className="truncate text-xs font-bold">{task.title}</h4>
                          <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                            {task.description}
                          </p>
                          <div className="font-mono text-[10px] font-semibold text-purple-700 dark:text-purple-400">
                            Potential Reward:{" "}
                            <strong className="text-emerald-700 dark:text-emerald-400">
                              ⭐ Up to {task.maxRates} Rates
                            </strong>
                          </div>
                          {task.requiredArtists && task.requiredArtists.length > 0 && (
                            <div className="font-mono text-[9px] text-primary">
                              🔒 Sync Artists:{" "}
                              <span className="font-bold text-foreground">
                                {task.requiredArtists.join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Instructions & Script details fully shown in My Task */}
                      {(task.instructions || task.script) && (
                        <div className="mt-1 space-y-2 rounded-xl border bg-background p-3">
                          <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-wide text-primary uppercase">
                            📋 Detailed Directives
                          </span>
                          {task.instructions && (
                            <p className="text-[11px] leading-relaxed">{task.instructions}</p>
                          )}
                          {task.script && (
                            <div className="rounded-lg border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
                              <span className="mb-1 block text-[9px] font-bold text-muted-foreground uppercase">
                                Production Script / Lyrics:
                              </span>
                              {task.script}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expiration Timer display bar / Completed Box */}
                      {isTaskCompleted(task) ? (
                        <div className="space-y-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-left">
                          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle className="size-3.5 shrink-0" />
                            <span>Approved & Verified Inspiration</span>
                          </div>
                          {task.reviewedAt && (
                            <div className="font-mono text-[9px] text-muted-foreground">
                              Approved on: {new Date(task.reviewedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 rounded-xl border bg-background p-3">
                          <div className="flex items-center justify-between font-mono text-[10px] font-semibold">
                            <span className="flex items-center gap-1.5">
                              <Clock className="size-3.5 text-primary" />
                              {remainingStr}
                            </span>
                            {!taskSub && (
                              <span className="font-bold text-muted-foreground">Limit: {hoursLimit}h</span>
                            )}
                          </div>

                          {!taskSub && (
                            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full transition-all duration-1000", barColor)}
                                style={{ width: `${100 - percentElapsed}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {!taskSub && task.status !== "completed" && (
                      <div className="flex justify-end border-t pt-3">
                        <Button type="button" size="sm" variant="outline" onClick={goToSubmit}>
                          <Zap className="size-3.5" data-icon="inline-start" />
                          Submit Clip
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredAndSortedTasks.length === 0 && (
              <div className="space-y-3 py-16 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-muted">
                  <Compass className="size-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">No Claimed Tasks Found</p>
                  <p className="mx-auto max-w-xs text-xs text-muted-foreground">
                    Browse the active inspiration pool to claim sandboxed jobs and build your
                    reputation ledger.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setMarketplaceMode("public")}>
                  Browse Inspirations
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
