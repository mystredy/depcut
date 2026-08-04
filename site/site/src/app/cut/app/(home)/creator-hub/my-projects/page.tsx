"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Filter,
  HelpCircle,
  Info,
  Layers,
  Play,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewProjectButton } from "@/cut/components/NewProjectButton";

// A submission's title/description can run to full-paragraph length; the
// table row only has room for a short line, so this clips by character
// count rather than relying on CSS truncate against unpredictable content.
function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
import { useLocalCompute } from "@/cut/lib/backend/hooks";
import { seedNewProjectDoc } from "@/cut/lib/docCache";
import { projectHref, useCutBase } from "@/cut/lib/nav";
import { backendFor, type Residency } from "@/cut/lib/queries";
import type { ProjectSummary } from "@/cut/lib/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { type Submission, useSubmissions } from "@/queries/submissions";

type SortTab = "Latest" | "Oldest";
type StatusFilter = "All" | "Qualified" | "Pending" | "In Review";

export default function MyProjectsPage() {
  const router = useRouter();
  const base = useCutBase();
  const submissionsQuery = useSubmissions();
  const submissions = useMemo(() => submissionsQuery.data?.submissions ?? [], [submissionsQuery.data]);

  const [selectedTab, setSelectedTab] = useState<SortTab>("Latest");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [infoItem, setInfoItem] = useState<Submission | null>(null);

  // Same creation path as the Cut editor's own Projects page (ProjectsHome):
  // create the project on the picked residency's backend, seed its doc cache
  // so the editor opens on the first frame, then jump straight in.
  const engineUp = useLocalCompute();
  const createProject = async (r: Residency) => {
    if (r !== "cloud" && !engineUp) return;
    const res = await backendFor(r).fetch("/api/cut/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled", folderId: null }),
    });
    const project = (await res.json()) as ProjectSummary;
    seedNewProjectDoc(project.id, project.name, r);
    track("project_created", { source: "my_projects" });
    router.push(projectHref(base, project.id, "projects", null));
  };

  const filteredAndSortedItems = useMemo(() => {
    return submissions.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.reviewRemark ?? "").toLowerCase().includes(q) ||
        (item.voiceScript ?? "").toLowerCase().includes(q);

      let matchesStatus = true;
      if (selectedStatus === "Qualified") {
        matchesStatus = item.reviewStatus === "Qualified";
      } else if (selectedStatus === "Pending") {
        matchesStatus = item.reviewStatus === "Pending" || !item.reviewStatus;
      } else if (selectedStatus === "In Review") {
        matchesStatus = item.reviewStatus === "InReview";
      }

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      const aTime = new Date(a.submittedAt).getTime();
      const bTime = new Date(b.submittedAt).getTime();
      return selectedTab === "Latest" ? bTime - aTime : aTime - bTime;
    });
  }, [submissions, searchQuery, selectedStatus, selectedTab]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" id="projects-view">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Submitted Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every project you've submitted for review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewProjectButton onCreate={(r) => void createProject(r)} />
          <Button onClick={() => router.push(`${base}/creator-hub/submit-project`)}>
            Submit New
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border bg-muted/40 p-1">
            {(["Latest", "Oldest"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedTab(tab)}
                className={cn(
                  "rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors",
                  selectedTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="hidden h-4 w-px bg-border sm:block" />

          <div className="flex flex-wrap rounded-xl border bg-muted/40 p-1">
            {(["All", "Qualified", "Pending", "In Review"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className={cn(
                  "rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors",
                  selectedStatus === status
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant={showFilter ? "default" : "outline"}
          onClick={() => {
            if (showFilter) setSearchQuery("");
            setShowFilter(!showFilter);
          }}
        >
          <Filter className="size-3.5" data-icon="inline-start" />
          Filter
        </Button>
      </div>

      {showFilter && (
        <label className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-1.5 focus-within:border-ring">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by title, script, remarks..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear
            </button>
          )}
        </label>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px]">Submission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Rates</TableHead>
              <TableHead className="text-right">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissionsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  Loading submissions…
                </TableCell>
              </TableRow>
            ) : filteredAndSortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="mx-auto max-w-sm space-y-2">
                    <Layers className="mx-auto size-6 text-muted-foreground" />
                    <p className="text-sm font-medium">No matching items found</p>
                    <p className="text-xs text-muted-foreground">
                      Try refining your filter, or submit your first project.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-black/5">
                        {item.hasThumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element -- submission thumbnail, served from our own API
                          <img
                            src={`/api/submissions/${item.id}/thumbnail?v=${encodeURIComponent(item.updatedAt)}`}
                            alt={`Video thumbnail: ${item.title}`}
                            className="size-full object-cover"
                          />
                        ) : (
                          <Layers className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{clip(item.title, 18)}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {clip(item.voiceScript || item.reviewRemark || "Submitted project video asset", 18)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setInfoItem(item)}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <Info className="size-3.5" /> Info
                          </button>
                          {item.hasVideo && (
                            <a
                              href={`/api/submissions/${item.id}/video`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                            >
                              <Play className="size-3.5" /> Play
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{renderStatusBadge(item.reviewStatus)}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {item.reviewStatus === "Qualified" ? `${item.earnedRates ?? 0}/${item.maxRates ?? 0}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-primary">{clip(item.category?.name ?? "General", 5)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>
          Showing {filteredAndSortedItems.length} of {submissions.length} submission projects.
        </span>
        <span className="flex items-center gap-1">
          <HelpCircle className="size-3.5" /> Need help? Visit creator training academy.
        </span>
      </div>

      <Dialog open={infoItem !== null} onOpenChange={(o) => !o && setInfoItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{infoItem?.title}</DialogTitle>
          </DialogHeader>
          {infoItem && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Voiceover script
                </p>
                <div className="max-h-24 overflow-y-auto rounded-xl border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  {infoItem.voiceScript || "No script available for this asset."}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {infoItem.earnedRates !== null && (
                  <InfoStat label="Rate" value={`${infoItem.earnedRates} / ${infoItem.maxRates ?? "—"}`} />
                )}
                <InfoStat label="Category" value={infoItem.category?.name || "General"} />
                <InfoStat
                  label="Submitted At"
                  value={new Date(infoItem.submittedAt).toLocaleString()}
                />
                <InfoStat label="Extension" value={infoItem.extension ?? "standard"} />
                <InfoStat label="Source" value={infoItem.subSource || "Inspired"} />
              </div>
              {(infoItem.statusRemark || infoItem.reviewRemark) && (
                <div className="space-y-1 rounded-xl border bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Status remark
                  </p>
                  <p className="text-xs leading-relaxed">
                    {infoItem.statusRemark || infoItem.reviewRemark}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoItem(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-medium">{value}</p>
    </div>
  );
}

function renderStatusBadge(reviewStatus: string | null) {
  if (!reviewStatus || reviewStatus === "Pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-400">
        <span className="size-1.5 rounded-full bg-blue-500" />
        Pending
      </span>
    );
  }
  if (reviewStatus === "Qualified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Qualified
      </span>
    );
  }
  if (reviewStatus === "Disqualified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-400">
        <span className="size-1.5 rounded-full bg-rose-500" />
        Disqualified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
      <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
      In Review
    </span>
  );
}
