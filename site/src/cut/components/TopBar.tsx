"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronLeft, CloudUpload, Loader2, MessageCircleHeart, Mic, MoreHorizontal, Redo2, Send, Share2, Sparkles, TriangleAlert, Undo2, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cloudBackend } from "@/cut/lib/backend/cloud";
import { cloudUsageQueryKey, useCutMode } from "@/cut/lib/backend/hooks";
import { localBackend } from "@/cut/lib/backend/local";
import { clearProjectThreads } from "@/cut/lib/chatThreads";
import { retryUpload } from "@/cut/lib/importQueue";
import { backTarget, projectHref, useCutBase } from "@/cut/lib/nav";
import { copyProjectAcross } from "@/cut/lib/projectCopy";
import { useEditor } from "@/cut/lib/store";
import { useCreateDraftSubmission } from "@/queries/submissions";
import { cn } from "@/lib/utils";
import { FeedbackDialog } from "@/cut/components/FeedbackDialog";
import { RecordDialog, type RecordMode } from "./RecordDialog";
import { ShareDialog } from "./ShareDialog";
import { StoragePill } from "./StoragePill";

/** Below `sm`, matching the rest of this bar's step-down breakpoints. Starts
 * `false` unconditionally (matching the server-rendered guess, which has no
 * `window` to read) and corrects itself post-mount — reading `window` in the
 * initializer instead would disagree with SSR on the very first client
 * render and trip a hydration mismatch on the project name text below. */
function useNarrowBar(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const onChange = () => setNarrow(!query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

/** A pixel-width `truncate` looks inconsistent across names (a few wide
 * capitals vs. many narrow lowercase letters land at different lengths) —
 * clipping to a fixed character count on mobile makes it predictable. */
const MOBILE_NAME_CHARS = 7;
const clipName = (name: string, narrow: boolean) =>
  narrow && name.length > MOBILE_NAME_CHARS ? `${name.slice(0, MOBILE_NAME_CHARS)}…` : name;

export function TopBar({
  onImport,
  from,
  folder,
  uploading = 0,
}: {
  onImport: (files: File[], opts?: { origin?: "recording" }) => void;
  from?: string | null;
  folder?: string | null;
  /** Media files currently importing; on a cloud project the save indicator
   * reports them ("Uploading") — those are real network uploads, not local
   * disk copies. */
  uploading?: number;
}) {
  const base = useCutBase();
  const narrowBar = useNarrowBar();
  const back = backTarget(base, from, folder);
  const hasClips = useEditor((s) => s.clips.length > 0);
  const projectName = useEditor((s) => s.projectName);
  const saveState = useEditor((s) => s.saveState);
  const aiOpen = useEditor((s) => s.aiOpen);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [recordMode, setRecordMode] = useState<RecordMode | null>(null);
  // The right-hand actions step down as the bar tightens: full labels →
  // icon-only Share/Cloud/Export → everything in a … menu. The storage pill
  // never folds. Which step fits is measured against hidden copies of the
  // full and compact rows, because the visible row can't report a width it
  // isn't showing. Every measured box is content-sized — none of them depend
  // on the chosen step — so the measurement can't feed back into itself.
  const headerRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const middleRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const fullRowRef = useRef<HTMLDivElement>(null);
  const compactRowRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<"full" | "compact" | "menu">("full");
  useEffect(() => {
    const boxes = [
      headerRef.current,
      leftRef.current,
      middleRef.current,
      pillRef.current,
      fullRowRef.current,
      compactRowRef.current,
    ];
    if (boxes.some((el) => !el)) return;
    const [header, left, middle, pill, fullRow, compactRow] = boxes as HTMLElement[];
    const refit = () => {
      // The fixed seams around the actions: the two spacers' min-w-2 (16),
      // the pill↔actions gap-2 (8), and the bar's pr-3 inset (12).
      const room =
        header.clientWidth -
        left.offsetWidth -
        middle.offsetWidth -
        pill.offsetWidth -
        36;
      setFit(
        fullRow.offsetWidth <= room
          ? "full"
          : compactRow.offsetWidth <= room
            ? "compact"
            : "menu"
      );
    };
    refit();
    // The header for the window resizing; the rest for their contents
    // changing — the project name, the custom-aspect editor, the pill and
    // buttons that come and go with the project's backend.
    const ro = new ResizeObserver(refit);
    boxes.forEach((el) => ro.observe(el!));
    return () => ro.disconnect();
  }, []);
  // "Move to Cloud": copies this local project — doc and every media file — to
  // the cloud, deletes the local original, and reopens the editor on the cloud
  // copy.
  const cutMode = useCutMode();
  const canMoveToCloud = cutMode === "local";
  // Submit to the marketplace: creates a draft linked to this project (only
  // meaningful in cloud mode — a local project has no CutProject row to
  // link) and hands off to the existing Submit Project flow.
  const router = useRouter();
  const createSubmission = useCreateDraftSubmission();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitProject = () => {
    setSubmitError(null);
    const projectId = useEditor.getState().projectId;
    if (!projectId) return;
    createSubmission.mutate(projectId, {
      onSuccess: (data) => router.push(`${base}/creator-hub/submit-project/${data.submission.id}`),
      onError: (e) => setSubmitError(e instanceof Error ? e.message : "Could not start the submission."),
    });
  };
  // Cloud imports are real uploads worth reporting; local imports are instant
  // disk copies, so they report nothing.
  const cloudUploading = uploading > 0 && cutMode === "cloud";
  // An import whose bytes never landed is absent from the saved document, so
  // its clip disappears on the next open. The Media panel shows this for a
  // dropped file, but a stock or library import lives on the timeline and has
  // no tile there — the save indicator is the one place every import reports.
  const failedImports = useEditor((s) => s.assets.filter((a) => a.upload?.error).length);
  const retryFailedImports = () => {
    for (const a of useEditor.getState().assets) if (a.upload?.error) retryUpload(a.id);
  };
  // Uploads settle in bursts; refresh the storage pill's number when a burst
  // ends. Only the settling edge counts — on mount nothing has landed yet.
  const queryClient = useQueryClient();
  const wasUploading = useRef(false);
  useEffect(() => {
    if (wasUploading.current && !cloudUploading) {
      void queryClient.invalidateQueries({ queryKey: cloudUsageQueryKey });
    }
    wasUploading.current = cloudUploading;
  }, [cloudUploading, queryClient]);
  const [shareOpen, setShareOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveProgress, setMoveProgress] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const moveToCloud = async () => {
    const projectId = useEditor.getState().projectId;
    if (!projectId) return;
    setMoving(true);
    setMoveError(null);
    try {
      // Let a pending autosave land so the copy reads the current cut.
      for (let i = 0; i < 40 && useEditor.getState().saveState !== "saved"; i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      const newId = await copyProjectAcross(localBackend, cloudBackend, projectId, {
        onProgress: (done, total) => setMoveProgress(`Moving media ${done}/${total}…`),
      });
      await localBackend
        .fetch(`/api/cut/projects/${projectId}`, { method: "DELETE" })
        .catch(() => {});
      // The chat history moved with the project; the old project's copy goes
      // with the project itself.
      clearProjectThreads(projectId);
      window.location.href = projectHref(base, newId, "projects", null);
    } catch (e) {
      setMoveError(
        e instanceof Error && e.message ? e.message : "Could not move the project."
      );
      setMoving(false);
      setMoveProgress(null);
    }
  };

  const commitName = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== projectName) useEditor.getState().setProjectName(name);
  };

  // A project that can't export yet (no clips, an upload still in flight, or
  // a failed import blocking the saved document) has nothing sharable or
  // submittable either — Share and Submit reuse Export's own gate rather
  // than risking a share link or marketplace submission to an incomplete cut.
  const exportBlocked = !hasClips || cloudUploading || failedImports > 0;
  const exportBlockedTitle = failedImports > 0
    ? "Retry the failed imports first"
    : cloudUploading
      ? "Finishing uploads…"
      : null;

  // One set of actions rendered both ways: labelled, and icon-only when the
  // bar tightens. Chat keeps its label in both fit tiers — it is the primary
  // control — but every label still drops below the mobile breakpoint.
  const actionButtons = (compact: boolean) => (
    <>
      {cutMode === "cloud" && (
        <Button
          variant="ghost"
          size={compact ? "icon-sm" : "sm"}
          className="max-sm:size-7 max-sm:px-0"
          aria-label="Share"
          disabled={exportBlocked}
          title={exportBlockedTitle ?? "Share"}
          onClick={() => setShareOpen(true)}
        >
          <Share2 data-icon={compact ? undefined : "inline-start"} />
          {!compact && <span className="hidden sm:inline">Share</span>}
        </Button>
      )}
      {canMoveToCloud && (
        // Our own tooltip, not the `title` attribute: the button's label is
        // just "Cloud", and the browser's native tooltip waits a beat before
        // saying what it does.
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size={compact ? "icon-sm" : "sm"}
                  aria-label="Move to Cloud"
                  onClick={() => setMoveOpen(true)}
                >
                  <CloudUpload data-icon={compact ? undefined : "inline-start"} />
                  {!compact && "Cloud"}
                </Button>
              }
            />
            <TooltipContent side="bottom">Move to Cloud</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <Button
        variant="ghost"
        size={compact ? "icon-sm" : "sm"}
        className="max-sm:size-7 max-sm:px-0"
        aria-label="Export"
        // A render reads the saved document, which an import still uploading
        // (or one that failed) is deliberately absent from — exporting now
        // would quietly leave it out of the video.
        disabled={exportBlocked}
        title={exportBlockedTitle ?? (compact ? "Export" : undefined)}
        onClick={() => {
          const s = useEditor.getState();
          s.setPlaying(false);
          s.setExportOpen(true);
        }}
      >
        <Upload data-icon={compact ? undefined : "inline-start"} />
        {!compact && <span className="hidden sm:inline">Export</span>}
      </Button>
      {cutMode === "cloud" && (
        <Button
          variant="ghost"
          size={compact ? "icon-sm" : "sm"}
          className="max-sm:size-7 max-sm:px-0"
          aria-label="Submit"
          disabled={createSubmission.isPending || exportBlocked}
          title={submitError ?? exportBlockedTitle ?? (compact ? "Submit" : undefined)}
          onClick={submitProject}
        >
          {createSubmission.isPending ? (
            <Loader2 data-icon={compact ? undefined : "inline-start"} className="animate-spin" />
          ) : (
            <Send data-icon={compact ? undefined : "inline-start"} />
          )}
          {!compact && <span className="hidden sm:inline">Submit</span>}
        </Button>
      )}
      <div aria-hidden className="h-4 w-px bg-border" />
      <Button
        variant={aiOpen ? "default" : "outline"}
        size="sm"
        className="ai-toggle max-sm:size-7 max-sm:px-0"
        aria-label="Chat"
        aria-pressed={aiOpen}
        title="Chat (⌘J)"
        onClick={() => {
          const s = useEditor.getState();
          s.setAiOpen(!s.aiOpen);
        }}
      >
        <Sparkles data-icon="inline-start" /> <span className="hidden sm:inline">Chat</span>
      </Button>
    </>
  );

  return (
    // One flex row — left group, switches, right rail — with a stretching
    // spacer either side of the switches. With room to spare the spacers
    // match and the switches sit centred; as the bar tightens they drift
    // toward whichever side has slack instead of colliding with the rail.
    <header
      ref={headerRef}
      className="relative flex items-center overflow-x-auto overflow-y-hidden border-b border-border bg-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div ref={leftRef} className="flex shrink-0 items-center gap-0.5 pl-1 sm:gap-1 sm:pl-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Back to ${back.tab}`}
          nativeButton={false}
          render={<Link href={back.href} />}
        >
          <ChevronLeft />
        </Button>
        <span className="grid size-[22px] shrink-0 place-items-center">
          <img
            src="/deepw-logo.svg"
            alt="DepCut"
            width={22}
            height={22}
            className="block h-full w-full object-contain"
          />
        </span>
        {editing ? (
          <input
            autoFocus
            className="ml-1.5 h-7 w-28 rounded-md border border-input bg-transparent px-2 text-sm font-medium outline-none select-text focus:border-ring sm:w-52"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <button
            className="ml-1.5 max-w-28 cursor-text truncate rounded-md px-2 py-1 text-sm font-medium tracking-tight hover:bg-muted sm:max-w-64"
            title="Rename project"
            onClick={() => {
              setDraft(projectName);
              setEditing(true);
            }}
          >
            {clipName(projectName, narrowBar)}
          </button>
        )}
        <span
          className={cn(
            "ml-2 flex items-center gap-1 text-[11px] text-muted-foreground transition-opacity",
            saveState === "saved" && !cloudUploading && "opacity-60"
          )}
        >
          {failedImports > 0 ? (
            <>
              <TriangleAlert className="size-3 text-destructive" />
              <span className="hidden text-destructive sm:inline">
                {failedImports === 1 ? "1 import failed" : `${failedImports} imports failed`}
              </span>
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={retryFailedImports}
              >
                Retry
              </button>
            </>
          ) : cloudUploading ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              <span className="hidden sm:inline">
                {uploading === 1 ? "Uploading" : `Uploading ${uploading} files`}
              </span>
            </>
          ) : saveState === "saving" || saveState === "dirty" ? (
            <>
              <Loader2 className="size-3 animate-spin" /> <span className="hidden sm:inline">Saving</span>
            </>
          ) : saveState === "error" ? (
            <>
              <TriangleAlert className="size-3 text-destructive" />
              <span className="hidden text-destructive sm:inline">Couldn’t save</span>
            </>
          ) : (
            <>
              <Check className="size-3" /> <span className="hidden sm:inline">Saved</span>
            </>
          )}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Undo"
                  className="ml-1"
                  disabled={!canUndo}
                  onClick={() => useEditor.getState().undo()}
                >
                  <Undo2 />
                </Button>
              }
            />
            <TooltipContent side="bottom">Undo (⌘Z)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Redo"
                  disabled={!canRedo}
                  onClick={() => useEditor.getState().redo()}
                >
                  <Redo2 />
                </Button>
              }
            />
            <TooltipContent side="bottom">Redo (⌘⇧Z)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="min-w-2 flex-1" />
      <div ref={middleRef} className="flex shrink-0 items-center gap-1 sm:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Record"
            className="record-switch flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:text-foreground sm:px-3"
          >
            <span className="size-2 rounded-full bg-red-500" aria-hidden />
            <span className="hidden sm:inline">Record</span>
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" style={{ width: "12rem" }}>
            <DropdownMenuItem onClick={() => setRecordMode("camera")}>
              <Video /> Record camera
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRecordMode("audio")}>
              <Mic /> Record audio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {recordMode && (
        <RecordDialog
          mode={recordMode}
          onClose={() => setRecordMode(null)}
          onUse={(file) => onImport([file], { origin: "recording" })}
        />
      )}
      <div className="min-w-2 flex-1" />
      {/* No clipping on the rail: stepping down is what keeps it inside the
          bar, and the hidden measuring rows need no help staying out of
          sight. Clipping would only shave the focus ring off the last
          button. */}
      <div className="flex shrink-0 items-center gap-1 pr-1 sm:gap-2 sm:pr-3">
        <div ref={pillRef} className="flex items-center">
          <StoragePill />
        </div>
        <div className="relative flex items-center">
          {/* Inert copies of the labelled and icon-only rows, held out of the
              flow; their natural widths are what the fit measurement reads. */}
          <div
            ref={fullRowRef}
            inert
            aria-hidden
            className="invisible absolute right-0 flex items-center gap-2"
          >
            {actionButtons(false)}
          </div>
          <div
            ref={compactRowRef}
            inert
            aria-hidden
            className="invisible absolute right-0 flex items-center gap-2"
          >
            {actionButtons(true)}
          </div>
          {fit !== "menu" ? (
            <div className="flex items-center gap-2">{actionButtons(fit === "compact")}</div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" aria-label="More actions" title="More actions" />}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {cutMode === "cloud" && (
                  <DropdownMenuItem disabled={exportBlocked} onClick={() => setShareOpen(true)}>
                    <Share2 /> Share
                  </DropdownMenuItem>
                )}
                {canMoveToCloud && (
                  <DropdownMenuItem onClick={() => setMoveOpen(true)}>
                    <CloudUpload /> Move to Cloud
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={exportBlocked}
                  onClick={() => {
                    const s = useEditor.getState();
                    s.setPlaying(false);
                    s.setExportOpen(true);
                  }}
                >
                  <Upload /> {exportBlockedTitle ?? "Export"}
                </DropdownMenuItem>
                {cutMode === "cloud" && (
                  <DropdownMenuItem
                    disabled={createSubmission.isPending || exportBlocked}
                    onClick={submitProject}
                  >
                    <Send /> Submit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    const s = useEditor.getState();
                    s.setAiOpen(!s.aiOpen);
                  }}
                >
                  <Sparkles />
                  <span className="flex-1">Chat</span>
                  {aiOpen && <Check className="size-3.5 text-muted-foreground" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
                  <MessageCircleHeart /> Give feedback
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {shareOpen && (
        <ShareDialog
          projectId={useEditor.getState().projectId ?? ""}
          onClose={() => setShareOpen(false)}
        />
      )}
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
      {moveOpen && (
        <Dialog open onOpenChange={(open) => !open && !moving && setMoveOpen(false)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Move to Cloud</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Copies this project and its media to the cloud, then removes it
              from this Mac. Exports rendered here stay behind.
            </p>
            {moveError && <p className="text-sm text-red-600">{moveError}</p>}
            <DialogFooter className="mt-2">
              <Button disabled={moving} className="w-full" onClick={() => void moveToCloud()}>
                {moving && <Loader2 className="animate-spin" data-icon="inline-start" />}
                {moving ? (moveProgress ?? "Moving…") : "Move to Cloud"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </header>
  );
}
