"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCutBase } from "@/cut/lib/nav";
import { cn } from "@/lib/utils";
import { ApiError, apiFetch } from "@/queries/apiClient";
import { useCategories } from "@/queries/categories";
import { creditBalanceQueryKey, useCreditBalance } from "@/queries/credits";
import {
  type AssetType,
  type AutosaveSubmissionInput,
  useAutosaveSubmission,
  useSubmission,
  useSubmitSubmission,
  useUploadSubmissionAsset,
} from "@/queries/submissions";
import { formatUsd } from "@/lib/credits/format-usd";

const THUMB_WIDTH = 480;
const THUMB_HEIGHT = 270;
const THUMB_TYPE = "image/webp";

// Renders into a fixed 16:9 canvas before upload, sized for the thumbnail
// card in My Submissions. A source that isn't already 16:9 (e.g. a 9:16
// portrait clip) keeps its full frame — drawn "contain" over a blurred,
// cover-scaled copy of itself filling the letterbox/pillarbox, the same
// treatment YouTube Studio uses for non-16:9 thumbnails — instead of a hard
// center-crop that would throw away the sides.
async function toThumbnail(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't prepare that image.");

    // Background: cover-fill, blurred, so the letterbox/pillarbox isn't bare.
    const coverScale = Math.max(THUMB_WIDTH / img.naturalWidth, THUMB_HEIGHT / img.naturalHeight);
    const coverWidth = img.naturalWidth * coverScale;
    const coverHeight = img.naturalHeight * coverScale;
    ctx.filter = "blur(16px)";
    ctx.drawImage(
      img,
      (THUMB_WIDTH - coverWidth) / 2,
      (THUMB_HEIGHT - coverHeight) / 2,
      coverWidth,
      coverHeight
    );
    ctx.filter = "none";

    // Foreground: contain-fit, sharp, centered — the whole frame, uncropped.
    const containScale = Math.min(THUMB_WIDTH / img.naturalWidth, THUMB_HEIGHT / img.naturalHeight);
    const containWidth = img.naturalWidth * containScale;
    const containHeight = img.naturalHeight * containScale;
    ctx.drawImage(
      img,
      (THUMB_WIDTH - containWidth) / 2,
      (THUMB_HEIGHT - containHeight) / 2,
      containWidth,
      containHeight
    );

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, THUMB_TYPE, 0.85));
    if (!blob) throw new Error("Couldn't prepare that image.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type SubmissionType = "Inspire" | "Task";
type WorkspaceCategory = "Beginner-Friendly" | "Professional Tools" | "Large Content Teams";
type Workspace = {
  id: string;
  name: string;
  category: WorkspaceCategory;
  connected: boolean;
  workspaceName: string;
  connectedEmail: string;
  features: string[];
};

const WORKSPACE_CATEGORIES: WorkspaceCategory[] = [
  "Beginner-Friendly",
  "Professional Tools",
  "Large Content Teams",
];

const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: "capcut",
    name: "CapCut Teams",
    category: "Beginner-Friendly",
    connected: false,
    workspaceName: "",
    connectedEmail: "",
    features: ["Cloud projects", "Shared workspaces", "Mobile + Desktop + Web sync"],
  },
  {
    id: "canva",
    name: "Canva Video Editor",
    category: "Beginner-Friendly",
    connected: false,
    workspaceName: "",
    connectedEmail: "",
    features: ["Real-time collaboration", "Shared assets", "Shorts/Reels presets"],
  },
  {
    id: "veed",
    name: "VEED.io Team",
    category: "Beginner-Friendly",
    connected: false,
    workspaceName: "",
    connectedEmail: "",
    features: ["Browser-based workspace", "Shared video review", "Auto subtitles share"],
  },
  {
    id: "premiere",
    name: "Adobe Premiere Pro + Frame.io",
    category: "Professional Tools",
    connected: false,
    workspaceName: "",
    connectedEmail: "",
    features: ["Deep cloud review", "Premiere project sharing", "Active feedback loops"],
  },
  {
    id: "davinci",
    name: "DaVinci Resolve + Blackmagic Cloud",
    category: "Professional Tools",
    connected: false,
    workspaceName: "",
    connectedEmail: "",
    features: ["Multi-user color/edit sync", "Blackmagic Cloud DB", "Proxy generator sync"],
  },
  {
    id: "finalcut",
    name: "Final Cut Pro Collaboration",
    category: "Professional Tools",
    connected: false,
    workspaceName: "",
    connectedEmail: "",
    features: ["FCP shared libraries", "iPad collaboration", "iCloud workflows"],
  },
  {
    id: "frameio",
    name: "Frame.io Direct Hub",
    category: "Large Content Teams",
    connected: false,
    workspaceName: "",
    connectedEmail: "",
    features: ["Professional video review", "Custom comments sync", "Automated status sync"],
  },
  {
    id: "postlab",
    name: "PostLab for FCP",
    category: "Large Content Teams",
    connected: false,
    workspaceName: "",
    connectedEmail: "",
    features: ["Cloud FCP libraries", "Locking & version tracking", "No-conflict edits"],
  },
  {
    id: "lucidlink",
    name: "LucidLink Filespace",
    category: "Large Content Teams",
    connected: false,
    workspaceName: "",
    connectedEmail: "",
    features: ["Zero-latency cloud drive", "Direct timeline streaming", "Active lock status"],
  },
];

type ChatCompletion = { choices: { message: { content: string } }[] };

// The plain chat/completions route — same real inference backend the app
// charges every hosted AI call against, just without an editor/project
// context. Each call bills the account's actual credit balance at the
// provider's real per-token rate; there is no separate "cost" to set here.
async function generateText(prompt: string, clientId: string): Promise<string> {
  const data = await apiFetch<ChatCompletion>("/api/inference/chat/completions", {
    method: "POST",
    headers: { "x-donkey-client-id": clientId },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });
  return data.choices[0]?.message.content?.trim() ?? "";
}

function parseTitles(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.]+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

type AiField = "title" | "description" | "tags" | "package";

// "New Submit" creates the row and lands here immediately (see the bare
// submit-project/page.tsx) — everything below is bound to that real
// Submission from the first keystroke. Every field autosaves; uploads start
// on pick and don't gate Submit; Submit locks the row and moves it to
// "submitting" without waiting for uploads to finish, and the page polls
// until the server promotes it to "submitted" (or drops it to "failed").
//
// Everything below the AI-generate buttons — task/workspace linking, the
// coupon code, and the "full package" cost — has no backend yet (no task
// marketplace, no editor-integration OAuth, no coupons table). It's kept as
// local component state so the interface is complete; wiring each piece to a
// real backend is follow-up work.
export default function SubmitProjectEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const base = useCutBase();
  const queryClient = useQueryClient();
  const credits = useCreditBalance();
  const categories = useCategories();

  const { data, isLoading, isError } = useSubmission(id);
  const submission = data?.submission ?? null;
  const isDraft = submission?.status === "draft";

  const autosave = useAutosaveSubmission(id);
  const submitMutation = useSubmitSubmission(id);
  const uploadAsset = useUploadSubmissionAsset(id);

  // One id for every AI call this page makes, so usage groups together.
  const [clientId] = useState(() => crypto.randomUUID());

  const [submissionType, setSubmissionType] = useState<SubmissionType>("Inspire");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  // The Pro publishing package's own title — becomes Upload.title, kept
  // separate from the project's Submission.title above.
  const [packageTitle, setPackageTitle] = useState("");
  const categoryLabel = categories.data?.categories.find((c) => c.id === category)?.name ?? "";
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [inspirationLink, setInspirationLink] = useState("");
  const [taskReference, setTaskReference] = useState("");
  const [vocalScript, setVocalScript] = useState("");
  const [checkedConfirm, setCheckedConfirm] = useState(false);

  const [generating, setGenerating] = useState<AiField | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number | null>(null);

  // Pro submissions carry an extra verification export proving the final
  // render matches what's described, so they need one more file than a
  // standard submission. Watermark and burn-in captions are captured here for
  // review, not applied — there's no render pipeline behind this form yet.
  const [isProMode, setIsProMode] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [burnInCaptions, setBurnInCaptions] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponValidated, setCouponValidated] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);

  // Workspace linking — no editor-integration backend exists, so "connected"
  // is only ever local state, and can't be resumed from a reload.
  const [workspaces, setWorkspaces] = useState<Workspace[]>(INITIAL_WORKSPACES);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [linking, setLinking] = useState(false);

  // Hydrate local field state from the fetched draft exactly once — after
  // that, this page (not the server) is the source of truth for what's on
  // screen until each edit autosaves back out.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !submission) return;
    hydratedRef.current = true;
    setSubmissionType(submission.subSource === "TaskExternal" ? "Task" : "Inspire");
    setTitle(submission.title ?? "");
    setCategory(submission.categoryId ?? "");
    setPackageTitle(submission.packageTitle ?? "");
    setDescription(submission.packageDescription ?? "");
    setTags(submission.packageTags ?? "");
    if (submission.subSource === "TaskExternal") setTaskReference(submission.inspireUrl ?? "");
    else setInspirationLink(submission.inspireUrl ?? "");
    setVocalScript(submission.voiceScript ?? "");
    setIsProMode(submission.extension === "pro");
    setWatermarkEnabled(submission.watermarkEnabled);
    setWatermarkText(submission.watermarkText ?? "");
    setBurnInCaptions(submission.burnInCaptions);
    setCouponCode(submission.editCode ?? "");
  }, [submission]);

  // Debounced autosave — batches whatever changed in the last 600ms into one
  // PATCH instead of one per keystroke. Only fires while still a draft.
  const pendingPatchRef = useRef<AutosaveSubmissionInput>({});
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutosave = (patch: AutosaveSubmissionInput) => {
    if (!isDraft) return;
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const toSave = pendingPatchRef.current;
      pendingPatchRef.current = {};
      if (Object.keys(toSave).length === 0) return;
      autosave.mutate(toSave, {
        // A failed batch isn't lost — merge it back in (newer edits win on
        // conflicting keys) so the next successful save carries it along too.
        onError: () => {
          pendingPatchRef.current = { ...toSave, ...pendingPatchRef.current };
        },
      });
    }, 600);
  };
  useEffect(
    () => () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    },
    []
  );
  const flushAutosave = async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const toSave = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (Object.keys(toSave).length > 0) await autosave.mutateAsync(toSave);
  };

  const updateSubmissionType = (mode: SubmissionType) => {
    setSubmissionType(mode);
    scheduleAutosave({ subSource: mode === "Inspire" ? "InspiredExternal" : "TaskExternal" });
  };
  const updateTitle = (value: string) => {
    setTitle(value);
    scheduleAutosave({ title: value });
  };
  const updateCategory = (value: string) => {
    setCategory(value);
    scheduleAutosave({ categoryId: value });
  };
  const updateSourceLink = (value: string) => {
    if (submissionType === "Inspire") setInspirationLink(value);
    else setTaskReference(value);
    scheduleAutosave({ inspireUrl: value });
  };
  const updateVocalScript = (value: string) => {
    setVocalScript(value);
    scheduleAutosave({ voiceScript: value });
  };
  const updateProMode = (v: boolean) => {
    setIsProMode(v);
    scheduleAutosave({ extension: v ? "pro" : "standard" });
  };
  const updateWatermarkEnabled = (v: boolean) => {
    setWatermarkEnabled(v);
    if (!v) setWatermarkText("");
    scheduleAutosave({ watermarkEnabled: v, watermarkText: v ? watermarkText : "" });
  };
  const updateWatermarkText = (value: string) => {
    setWatermarkText(value);
    scheduleAutosave({ watermarkText: value });
  };
  const updateBurnInCaptions = (v: boolean) => {
    setBurnInCaptions(v);
    scheduleAutosave({ burnInCaptions: v });
  };
  const updateSelectedWorkspaceId = (wsId: string) => {
    setSelectedWorkspaceId(wsId);
    scheduleAutosave({ spaceid: wsId });
  };
  const updatePackageTitle = (value: string) => {
    setPackageTitle(value);
    scheduleAutosave({ packageTitle: value });
  };
  const updateDescription = (value: string) => {
    setDescription(value);
    scheduleAutosave({ packageDescription: value });
  };
  const updateTags = (value: string) => {
    setTags(value);
    scheduleAutosave({ packageTags: value });
  };
  const updateCouponCode = (value: string) => {
    setCouponCode(value);
    setCouponValidated(false);
    setCouponMessage(null);
    scheduleAutosave({ editCode: value });
  };

  // ---- media ----
  const videoAsset = submission?.assets.find((a) => a.type === "video") ?? null;
  const thumbnailAsset = submission?.assets.find((a) => a.type === "thumbnail") ?? null;
  const verificationAsset = submission?.assets.find((a) => a.type === "verification") ?? null;

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoPreviewUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailUploadProgress, setThumbnailUploadProgress] = useState<number | null>(null);
  const [thumbnailUploadError, setThumbnailUploadError] = useState<string | null>(null);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const mediaPreviewUrl = useMemo(() => (mediaFile ? URL.createObjectURL(mediaFile) : null), [mediaFile]);
  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<number | null>(null);
  const [verificationUploadError, setVerificationUploadError] = useState<string | null>(null);

  const [videoDragging, setVideoDragging] = useState(false);
  const [thumbnailDragging, setThumbnailDragging] = useState(false);
  const [verificationDragging, setVerificationDragging] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const verificationInputRef = useRef<HTMLInputElement>(null);

  // A resumed draft's picked files only exist as R2 keys, not local File
  // objects (browsers can't rehydrate those across a reload) — fall back to
  // the signed-redirect GET route once an asset has actually landed.
  const videoDisplayUrl = videoPreviewUrl ?? (videoAsset?.storageKey ? `/api/submissions/${id}/video` : null);
  const thumbnailDisplayUrl =
    thumbnailPreview ?? (thumbnailAsset?.storageKey ? `/api/submissions/${id}/thumbnail` : null);
  const mediaDisplayUrl =
    mediaPreviewUrl ?? (verificationAsset?.storageKey ? `/api/submissions/${id}/verification` : null);

  // Uploads are plain browser XHR calls tied to this page — a refresh or tab
  // close mid-upload silently kills them. Warn instead of letting that
  // happen invisibly; the stale-submitting sweep is the backstop if it
  // happens anyway.
  const uploadingInFlight =
    videoUploadProgress !== null || thumbnailUploadProgress !== null || mediaUploadProgress !== null;
  useEffect(() => {
    if (!uploadingInFlight) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploadingInFlight]);

  // Whether a dropzone accepts a new pick right now: freely while drafting,
  // or to retry specifically the asset that failed once the submission is
  // locked at "failed" — every other field stays read-only at that point.
  const assetInteractive = (asset: { status: string } | null) =>
    isDraft || (submission?.status === "failed" && (!asset || asset.status === "failed"));

  const pickVideo = (file: File) => {
    setVideoFile(file);
    setVideoUploadError(null);
    setVideoUploadProgress(0);
    uploadAsset.mutate(
      { type: "video", file, onProgress: setVideoUploadProgress },
      {
        onError: () => setVideoUploadError("Couldn't upload the video — try again."),
        onSettled: () => setVideoUploadProgress(null),
      }
    );
  };

  const pickThumbnail = (file: File) => {
    setThumbnailFile(file);
    setThumbnailUploadError(null);
    const reader = new FileReader();
    reader.onloadend = () => setThumbnailPreview(reader.result as string);
    reader.readAsDataURL(file);

    setThumbnailUploadProgress(0);
    toThumbnail(file)
      .then((blob) =>
        uploadAsset.mutate(
          { type: "thumbnail", file: blob, onProgress: setThumbnailUploadProgress },
          {
            onError: () => setThumbnailUploadError("Couldn't upload the thumbnail — try again."),
            onSettled: () => setThumbnailUploadProgress(null),
          }
        )
      )
      .catch(() => {
        setThumbnailUploadError("Couldn't prepare that thumbnail — try again.");
        setThumbnailUploadProgress(null);
      });
  };

  const pickVerification = (file: File) => {
    setMediaFile(file);
    setVerificationUploadError(null);
    setMediaUploadProgress(0);
    uploadAsset.mutate(
      { type: "verification", file, onProgress: setMediaUploadProgress },
      {
        onError: () => setVerificationUploadError("Couldn't upload the verification export — try again."),
        onSettled: () => setMediaUploadProgress(null),
      }
    );
  };

  const runGenerate = async (field: AiField, prompt: string, apply: (text: string) => void) => {
    setAiError(null);
    setGenerating(field);
    try {
      const text = await generateText(prompt, clientId);
      if (text) {
        apply(text);
        scheduleAutosave({ generatedMetadata: true });
      }
      // The balance shown near the button just charged; refetch so it's current.
      void queryClient.invalidateQueries({ queryKey: creditBalanceQueryKey });
    } catch (error) {
      if (error instanceof ApiError && error.code === "insufficient_credits") {
        setAiError("Not enough AI credits for that. Buy more from Billing.");
      } else {
        setAiError("Couldn't generate that just now. Try again in a moment.");
      }
    } finally {
      setGenerating(null);
    }
  };

  const generateTitle = () =>
    runGenerate(
      "title",
      `Write one short, catchy, click-worthy video title. No quotes, no markdown, no trailing punctuation. Category: "${categoryLabel || "video"}". Voice-over/script: "${vocalScript}". ${description ? `Description: "${description}".` : ""} Base the title on what the script actually says. Return only the title text.`,
      updatePackageTitle
    );

  const generateDescription = () =>
    runGenerate(
      "description",
      `Write a short, engaging 2-3 sentence description for a video titled "${packageTitle}"${categoryLabel ? ` in the "${categoryLabel}" category` : ""}. Voice-over/script: "${vocalScript}". Base the description on what the script actually says. No markdown, no quotes. Return only the description text.`,
      updateDescription
    );

  const generateTags = () =>
    runGenerate(
      "tags",
      `Suggest exactly 8 relevant, lowercase, comma-separated tags (no "#" symbol) for a video titled "${packageTitle}"${categoryLabel ? ` in the "${categoryLabel}" category` : ""}. Voice-over/script: "${vocalScript}". Base the tags on what the script actually says. Return only the comma-separated tags, nothing else.`,
      updateTags
    );

  const generatePackage = async () => {
    setAiError(null);
    setGenerating("package");
    try {
      const raw = await generateText(
        `Generate a viral social video package for a video titled "${packageTitle || title || "this video"}"${categoryLabel ? ` in the "${categoryLabel}" category` : ""}. Voice-over/script: "${vocalScript}". Base everything on what the script actually says. Return exactly this format, nothing else:\nTITLES:\n1. ...\n2. ...\n3. ...\n4. ...\n5. ...\nDESCRIPTION:\n...\nTAGS:\ncomma, separated, tags`,
        clientId
      );
      const titlesBlock = raw.split(/DESCRIPTION:/i)[0]?.replace(/TITLES:/i, "") ?? "";
      const rest = raw.split(/DESCRIPTION:/i)[1] ?? "";
      const [descBlock, tagsBlock] = rest.split(/TAGS:/i);
      const titles = parseTitles(titlesBlock);
      const patch: AutosaveSubmissionInput = {};
      if (titles.length) {
        setGeneratedTitles(titles);
        setSelectedTitleIndex(0);
        setPackageTitle(titles[0]);
        patch.packageTitle = titles[0];
      }
      if (descBlock?.trim()) {
        setDescription(descBlock.trim());
        patch.packageDescription = descBlock.trim();
      }
      if (tagsBlock?.trim()) {
        setTags(tagsBlock.trim());
        patch.packageTags = tagsBlock.trim();
      }
      if (Object.keys(patch).length > 0) scheduleAutosave({ ...patch, generatedMetadata: true });
      void queryClient.invalidateQueries({ queryKey: creditBalanceQueryKey });
    } catch (error) {
      if (error instanceof ApiError && error.code === "insufficient_credits") {
        setAiError("Not enough AI credits for that. Buy more from Billing.");
      } else {
        setAiError("Couldn't generate that just now. Try again in a moment.");
      }
    } finally {
      setGenerating(null);
    }
  };

  const validateCoupon = () => {
    if (!couponFormatValid) return;
    setCouponChecking(true);
    setCouponMessage(null);
    // No coupons backend exists — this only checks the code's shape.
    setTimeout(() => {
      setCouponChecking(false);
      setCouponValidated(true);
      setCouponMessage(`"${couponCode.trim().toUpperCase()}" looks valid.`);
    }, 600);
  };

  const balanceLabel = useMemo(() => {
    if (credits.isLoading) return null;
    return formatUsd(credits.data?.balance ?? "0");
  }, [credits.isLoading, credits.data]);

  const openConnect = (wsId: string) => {
    setConnectingId(wsId);
    setTeamName("");
    setMemberEmail("");
  };

  const confirmConnect = () => {
    if (!connectingId || !teamName.trim()) return;
    setLinking(true);
    setTimeout(() => {
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === connectingId
            ? { ...w, connected: true, workspaceName: teamName.trim(), connectedEmail: memberEmail.trim() }
            : w
        )
      );
      updateSelectedWorkspaceId(connectingId);
      setLinking(false);
      setConnectingId(null);
      setTeamName("");
      setMemberEmail("");
    }, 900);
  };

  const disconnect = (wsId: string) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === wsId ? { ...w, connected: false, workspaceName: "", connectedEmail: "" } : w))
    );
    if (selectedWorkspaceId === wsId) updateSelectedWorkspaceId("");
  };

  const connectedWorkspaces = workspaces.filter((w) => w.connected);
  const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(couponCode.trim());
  const startsWithTwoLetters = /^[a-zA-Z]{2}/.test(couponCode.trim());
  const couponFormatValid = couponCode.trim().length >= 8 && startsWithTwoLetters && isAlphanumeric;

  // Doesn't require uploads to finish — only that something's been picked.
  // Submit locks the row in and lets those uploads keep running in the
  // background; the server promotes to "submitted" once they land.
  const hasVideo = Boolean(videoFile) || Boolean(videoAsset?.storageKey);
  const hasThumbnail = Boolean(thumbnailFile) || Boolean(thumbnailAsset?.storageKey);
  const hasVerification = Boolean(mediaFile) || Boolean(verificationAsset?.storageKey);

  const canSubmit = Boolean(
    isDraft &&
      title.trim() &&
      category &&
      hasVideo &&
      hasThumbnail &&
      selectedWorkspaceId &&
      (submissionType === "Inspire" ? inspirationLink.trim() : taskReference.trim()) &&
      vocalScript.trim() &&
      checkedConfirm &&
      (!isProMode || (hasVerification && packageTitle.trim() && description.trim() && tags.trim())) &&
      (!watermarkEnabled || watermarkText.trim())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitMutation.isPending) return;
    await flushAutosave();
    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center p-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !submission) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 p-6">
        <p className="text-sm text-muted-foreground">Couldn't find that submission.</p>
        <Button variant="outline" onClick={() => router.push(`${base}/creator-hub/my-projects`)}>
          Back to My Submissions
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Submit Project</h1>
          <p className="mt-1 text-sm text-muted-foreground">Share a finished video for review.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2">
          <span
            className={cn(
              "text-xs font-bold tracking-wider",
              isProMode ? "text-primary" : "text-muted-foreground"
            )}
          >
            PRO
          </span>
          <Switch
            checked={isProMode}
            onCheckedChange={(v) => {
              updateProMode(v);
              if (!v) setVerificationUploadError(null);
            }}
            disabled={!isDraft}
            aria-label="Pro submission"
          />
        </div>
      </div>

      {submission.status !== "draft" && (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-2xl border p-4 text-sm font-medium",
            submission.status === "submitting" && "border-primary/20 bg-primary/5",
            submission.status === "failed" && "border-destructive/20 bg-destructive/5 text-destructive",
            (submission.status === "submitted" ||
              submission.status === "Approved" ||
              submission.status === "Rejected") &&
              "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
          )}
        >
          {submission.status === "submitting" && <Loader2 className="size-4 shrink-0 animate-spin" />}
          {submission.status === "failed" && <AlertCircle className="size-4 shrink-0" />}
          {(submission.status === "submitted" ||
            submission.status === "Approved" ||
            submission.status === "Rejected") && <CheckCircle2 className="size-4 shrink-0" />}
          <span>
            {submission.status === "submitting" &&
              "Submission in progress — finishing your uploads before sending this to review. You don't need to click Submit again."}
            {submission.status === "failed" &&
              "Action required — an upload didn't make it. Retry it below to finish submitting."}
            {submission.status === "submitted" && "Submitted — pending review."}
            {submission.status === "Approved" && "Approved."}
            {submission.status === "Rejected" && "Not approved."}
          </span>
        </div>
      )}

      {isDraft && autosave.isError && (
        <p role="alert" className="text-sm text-destructive">
          {autosave.error instanceof Error ? autosave.error.message : "Couldn't save your last change."}{" "}
          It'll retry automatically on your next edit.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border bg-card p-6 lg:col-span-8"
        >
          {/* Submission mode */}
          <div className="flex rounded-2xl border bg-muted/40 p-1">
            {(["Inspire", "Task"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={!isDraft}
                onClick={() => updateSubmissionType(m)}
                className={cn(
                  "flex-1 rounded-xl py-2 text-xs font-semibold transition-colors",
                  submissionType === m
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  !isDraft && "cursor-not-allowed opacity-60"
                )}
              >
                {m} Mode
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="submit-title">
              Video Project Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="submit-title"
              value={title}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder="e.g. City Lights — a short film"
              disabled={!isDraft}
              required
            />
            {generatedTitles.length > 0 && (
              <div className="space-y-1 rounded-xl border bg-muted/30 p-2">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  AI title options
                </p>
                {generatedTitles.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedTitleIndex(i);
                      updateTitle(t);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                      selectedTitleIndex === i
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-bold">
                      {i + 1}
                    </span>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={category}
              onValueChange={(value) => value && updateCategory(value)}
              disabled={categories.isLoading || !isDraft}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={categories.isLoading ? "Loading categories…" : "Choose a category"}>
                  {(value: string | null) => {
                    const match = categories.data?.categories.find((c) => c.id === value);
                    if (match) return `${match.emoji} ${match.name}`;
                    return categories.isLoading ? "Loading categories…" : "Choose a category";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.data?.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="submit-source">
                {submissionType === "Inspire" ? "Inspiration / Source Link" : "Task Reference"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="submit-source"
                type={submissionType === "Inspire" ? "url" : "text"}
                value={submissionType === "Inspire" ? inspirationLink : taskReference}
                onChange={(e) => updateSourceLink(e.target.value)}
                placeholder={
                  submissionType === "Inspire"
                    ? "e.g. https://inspiration-source.com/video"
                    : "The task ID or brief you're submitting against"
                }
                disabled={!isDraft}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="submit-script">
                Voice-Over / Script <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="submit-script"
                value={vocalScript}
                onChange={(e) => updateVocalScript(e.target.value)}
                placeholder="The voice-over or subtitle script used in this video"
                rows={1}
                disabled={!isDraft}
                required
              />
            </div>
          </div>

          {submission?.projectId ? (
            <div className="space-y-2">
              <Label>Source project</Label>
              <div className="flex items-center gap-2 rounded-2xl border p-4">
                <Film className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {submission.project?.name ?? "Untitled project"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Video, thumbnail come from this project — nothing to upload here.
                  </p>
                </div>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Video <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                onClick={() => assetInteractive(videoAsset) && videoInputRef.current?.click()}
                onDragOver={(e) => {
                  if (!assetInteractive(videoAsset)) return;
                  e.preventDefault();
                  setVideoDragging(true);
                }}
                onDragLeave={() => setVideoDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setVideoDragging(false);
                  if (!assetInteractive(videoAsset)) return;
                  const file = e.dataTransfer.files[0];
                  if (file?.type.startsWith("video/")) pickVideo(file);
                }}
                className={cn(
                  "relative flex h-28 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed p-6 text-center transition-colors",
                  videoDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                  !assetInteractive(videoAsset) && "cursor-default hover:bg-transparent"
                )}
              >
                {videoDisplayUrl ? (
                  <>
                    {/* Same blurred cover-fill + contain-fit treatment as the
                        thumbnail preview, so a non-16:9 video isn't cropped. */}
                    <video
                      src={videoDisplayUrl}
                      muted
                      autoPlay
                      loop
                      playsInline
                      aria-hidden
                      className="absolute inset-0 size-full scale-110 object-cover blur-xl"
                    />
                    <video
                      src={videoDisplayUrl}
                      muted
                      autoPlay
                      loop
                      playsInline
                      className="absolute inset-0 size-full object-contain"
                    />
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {videoFile?.name ?? videoAsset?.fileName ?? "video"}
                      {videoAsset?.status === "complete" && " · Uploaded"}
                      {videoAsset?.status === "failed" && " · Failed"}
                    </span>
                  </>
                ) : (
                  <>
                    <Film className="size-6 text-muted-foreground" />
                    <span className="text-xs font-medium">Drop a video, or click to browse</span>
                  </>
                )}
              </button>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) pickVideo(file);
                }}
              />
              {videoUploadProgress !== null && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Uploading video… {Math.round(videoUploadProgress * 100)}%
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${Math.round(videoUploadProgress * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {videoUploadError && (
                <p role="alert" className="text-xs text-destructive">
                  {videoUploadError}
                </p>
              )}
              {!videoUploadError && videoAsset?.status === "failed" && videoAsset.error && (
                <p role="alert" className="text-xs text-destructive">
                  {videoAsset.error} Drop the video again to retry.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Thumbnail <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                onClick={() => assetInteractive(thumbnailAsset) && thumbnailInputRef.current?.click()}
                onDragOver={(e) => {
                  if (!assetInteractive(thumbnailAsset)) return;
                  e.preventDefault();
                  setThumbnailDragging(true);
                }}
                onDragLeave={() => setThumbnailDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setThumbnailDragging(false);
                  if (!assetInteractive(thumbnailAsset)) return;
                  const file = e.dataTransfer.files[0];
                  if (file?.type.startsWith("image/")) pickThumbnail(file);
                }}
                className={cn(
                  "relative flex h-28 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed p-6 text-center transition-colors",
                  thumbnailDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                  !assetInteractive(thumbnailAsset) && "cursor-default hover:bg-transparent"
                )}
              >
                {thumbnailDisplayUrl ? (
                  <>
                    {/* Blurred cover-fill background, same treatment as the uploaded
                        thumbnail (see toThumbnail) — so a non-16:9 pick previews the
                        way it'll actually look, not hard-cropped. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- local file preview, not a Next asset */}
                    <img
                      src={thumbnailDisplayUrl}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 size-full scale-110 object-cover blur-xl"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- local file preview, not a Next asset */}
                    <img
                      src={thumbnailDisplayUrl}
                      alt=""
                      className="absolute inset-0 size-full object-contain"
                    />
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {thumbnailFile?.name ?? thumbnailAsset?.fileName ?? "thumbnail"}
                      {thumbnailAsset?.status === "complete" && " · Uploaded"}
                      {thumbnailAsset?.status === "failed" && " · Failed"}
                    </span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="size-6 text-muted-foreground" />
                    <span className="text-xs font-medium">Drop an image, or click to browse</span>
                  </>
                )}
              </button>
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) pickThumbnail(file);
                }}
              />
              {thumbnailUploadProgress !== null && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Uploading thumbnail… {Math.round(thumbnailUploadProgress * 100)}%
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${Math.round(thumbnailUploadProgress * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {thumbnailUploadError && (
                <p role="alert" className="text-xs text-destructive">
                  {thumbnailUploadError}
                </p>
              )}
              {!thumbnailUploadError && thumbnailAsset?.status === "failed" && thumbnailAsset.error && (
                <p role="alert" className="text-xs text-destructive">
                  {thumbnailAsset.error} Drop the thumbnail again to retry.
                </p>
              )}
            </div>
          </div>
          )}

          {/* Linked Collaboration Pipeline */}
          <div className="space-y-3 rounded-2xl border border-dashed p-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Link2 className="size-3.5 text-primary" />
                Linked Collaboration Pipeline <span className="text-destructive">*</span>
              </Label>
              <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Remote workspace gate
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Connect a remote editing workspace (CapCut, Premiere + Frame.io, and others) to
              exchange timelines and review edits.
            </p>

            {connectedWorkspaces.length === 0 ? (
              <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-xs font-semibold text-destructive">Workspace linkage required</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Link at least one workspace to submit a project.
                    </p>
                  </div>
                </div>
                <Button type="button" size="sm" disabled={!isDraft} onClick={() => setConnectOpen(true)}>
                  Connect Workspace
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={selectedWorkspaceId}
                    onValueChange={(value) => value && updateSelectedWorkspaceId(value)}
                    disabled={!isDraft}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose a connected workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedWorkspaces.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} — {w.workspaceName || "Main team space"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!isDraft}
                    onClick={() => setConnectOpen(true)}
                  >
                    Manage ({connectedWorkspaces.length})
                  </Button>
                </div>
                {selectedWorkspaceId && (
                  <p className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <Check className="size-3.5 shrink-0" />
                    Pipeline active with{" "}
                    <strong>{workspaces.find((w) => w.id === selectedWorkspaceId)?.workspaceName}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {isProMode && (
            <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <p className="text-xs font-semibold">Pro Verification Suite</p>
              </div>

              <div className="space-y-2">
                <Label>Edit code</Label>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => updateCouponCode(e.target.value)}
                    placeholder="e.g. AB123456"
                    className="uppercase"
                    disabled={!isDraft}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!couponFormatValid || couponChecking || !isDraft}
                    onClick={validateCoupon}
                  >
                    {couponChecking ? <Loader2 className="size-3.5 animate-spin" /> : "Check"}
                  </Button>
                </div>
                {couponMessage && (
                  <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    {couponMessage}
                  </p>
                )}
              </div>

              {couponValidated && (
                <>
                  <div className="flex items-center justify-between gap-4 rounded-xl border bg-background p-3">
                    <div>
                      <p className="text-xs font-semibold">Video watermark</p>
                      <p className="text-[11px] text-muted-foreground">Brand the submitted video.</p>
                    </div>
                    <Switch
                      checked={watermarkEnabled}
                      onCheckedChange={updateWatermarkEnabled}
                      disabled={!isDraft}
                      aria-label="Enable watermark"
                    />
                  </div>
                  {watermarkEnabled && (
                    <Input
                      value={watermarkText}
                      onChange={(e) => updateWatermarkText(e.target.value)}
                      placeholder="Watermark text, e.g. @yourhandle"
                      disabled={!isDraft}
                      required={watermarkEnabled}
                    />
                  )}

                  <div className="flex items-center justify-between gap-4 rounded-xl border bg-background p-3">
                    <div>
                      <p className="text-xs font-semibold">Burn-in captions</p>
                      <p className="text-[11px] text-muted-foreground">Style captions into the frame.</p>
                    </div>
                    <Switch
                      checked={burnInCaptions}
                      onCheckedChange={updateBurnInCaptions}
                      disabled={!isDraft}
                      aria-label="Enable burn-in captions"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2 rounded-xl border bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <Sparkles className="size-3.5 text-primary" />
                    Viral package generator
                  </p>
                  {balanceLabel && (
                    <span className="text-[10px] text-muted-foreground">
                      Balance: <span className="font-mono">{balanceLabel}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Generates 5 title options, a description, and tags in one AI call.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={generating === "package" || !vocalScript.trim() || !isDraft}
                  title={!vocalScript.trim() ? "Add a voice-over script first" : undefined}
                  onClick={generatePackage}
                >
                  {generating === "package" ? (
                    <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                  ) : (
                    <Sparkles data-icon="inline-start" />
                  )}
                  Generate Full Package
                </Button>
                {!vocalScript.trim() && (
                  <p className="text-[11px] text-muted-foreground">
                    Add a Voice-Over / Script above so the AI has something to base this on.
                  </p>
                )}
                {aiError && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" />
                    {aiError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="submit-pro-title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <AiButton
                    loading={generating === "title"}
                    onClick={generateTitle}
                    label="Generate"
                    disabled={!vocalScript.trim() || !isDraft}
                    title={!vocalScript.trim() ? "Add a voice-over script first" : undefined}
                  />
                </div>
                <Input
                  id="submit-pro-title"
                  value={packageTitle}
                  onChange={(e) => updatePackageTitle(e.target.value)}
                  placeholder="e.g. City Lights — a short film"
                  disabled={!isDraft}
                  required
                />
                {generatedTitles.length > 0 && (
                  <div className="space-y-1 rounded-xl border bg-background p-2">
                    <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      AI title options
                    </p>
                    {generatedTitles.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedTitleIndex(i);
                          updatePackageTitle(t);
                        }}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                          selectedTitleIndex === i
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-bold">
                          {i + 1}
                        </span>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="submit-description">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <AiButton
                    loading={generating === "description"}
                    onClick={generateDescription}
                    label="Generate"
                    disabled={!vocalScript.trim() || !packageTitle.trim() || !isDraft}
                    title={
                      !vocalScript.trim()
                        ? "Add a voice-over script first"
                        : !packageTitle.trim()
                          ? "Add a title first"
                          : undefined
                    }
                  />
                </div>
                <Textarea
                  id="submit-description"
                  value={description}
                  onChange={(e) => updateDescription(e.target.value)}
                  placeholder="What's this project about?"
                  rows={4}
                  disabled={!isDraft}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="submit-tags">
                    Tags <span className="text-destructive">*</span>
                  </Label>
                  <AiButton
                    loading={generating === "tags"}
                    onClick={generateTags}
                    label="Generate"
                    disabled={!vocalScript.trim() || !packageTitle.trim() || !isDraft}
                    title={
                      !vocalScript.trim()
                        ? "Add a voice-over script first"
                        : !packageTitle.trim()
                          ? "Add a title first"
                          : undefined
                    }
                  />
                </div>
                <Input
                  id="submit-tags"
                  value={tags}
                  onChange={(e) => updateTags(e.target.value)}
                  placeholder="comma, separated, tags"
                  disabled={!isDraft}
                  required
                />
              </div>

              {submission?.projectId ? (
                <p className="text-xs text-muted-foreground">
                  Verification come from this project — nothing to upload here.
                </p>
              ) : (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Verification export <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pro submissions include a fresh export from the editor, matched against the video
                  above to verify it's the final cut.
                </p>
                <button
                  type="button"
                  onClick={() => assetInteractive(verificationAsset) && verificationInputRef.current?.click()}
                  onDragOver={(e) => {
                    if (!assetInteractive(verificationAsset)) return;
                    e.preventDefault();
                    setVerificationDragging(true);
                  }}
                  onDragLeave={() => setVerificationDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setVerificationDragging(false);
                    if (!assetInteractive(verificationAsset)) return;
                    const file = e.dataTransfer.files[0];
                    if (file?.type.startsWith("video/")) pickVerification(file);
                  }}
                  className={cn(
                    "relative flex h-28 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed bg-background p-6 text-center transition-colors",
                    verificationDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted",
                    !assetInteractive(verificationAsset) && "cursor-default hover:bg-transparent"
                  )}
                >
                  {mediaDisplayUrl ? (
                    <>
                      <video
                        src={mediaDisplayUrl}
                        muted
                        autoPlay
                        loop
                        playsInline
                        aria-hidden
                        className="absolute inset-0 size-full scale-110 object-cover blur-xl"
                      />
                      <video
                        src={mediaDisplayUrl}
                        muted
                        autoPlay
                        loop
                        playsInline
                        className="absolute inset-0 size-full object-contain"
                      />
                      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {mediaFile?.name ?? verificationAsset?.fileName ?? "verification"}
                        {verificationAsset?.status === "complete" && " · Uploaded"}
                        {verificationAsset?.status === "failed" && " · Failed"}
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-6 text-muted-foreground" />
                      <span className="text-xs font-medium">Drop a video, or click to browse</span>
                    </>
                  )}
                </button>
                <input
                  ref={verificationInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) pickVerification(file);
                  }}
                />
                {mediaUploadProgress !== null && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Uploading verification export… {Math.round(mediaUploadProgress * 100)}%
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${Math.round(mediaUploadProgress * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {verificationUploadError && (
                  <p role="alert" className="text-sm text-destructive">
                    {verificationUploadError}
                  </p>
                )}
                {!verificationUploadError && verificationAsset?.status === "failed" && verificationAsset.error && (
                  <p role="alert" className="text-xs text-destructive">
                    {verificationAsset.error} Drop the export again to retry.
                  </p>
                )}
              </div>
              )}
            </div>
          )}

          {isDraft && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3">
              <input
                type="checkbox"
                checked={checkedConfirm}
                onChange={(e) => setCheckedConfirm(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="text-xs leading-relaxed text-muted-foreground">
                I confirm this video meets the quality guidelines, uses the correct aspect ratio and
                legal audio assets, and that stolen or low-quality content will be rejected.
              </span>
            </label>
          )}

          {submitMutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {submitMutation.error instanceof Error ? submitMutation.error.message : "Couldn't submit that just now."}
            </p>
          )}

          {isDraft && (
            <Button type="submit" disabled={!canSubmit || submitMutation.isPending} className="w-full">
              {submitMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              ) : (
                <Upload data-icon="inline-start" />
              )}
              Submit
            </Button>
          )}

          {!isDraft && submission.status !== "submitting" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push(`${base}/creator-hub/my-projects`)}
            >
              Back to My Submissions
            </Button>
          )}
        </form>

        {/* Collaboration Hub */}
        <div className="space-y-4 rounded-3xl border bg-card p-6 lg:col-span-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Collaboration Hub</p>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {connectedWorkspaces.length} linked
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Link remote team workspaces to sync edit projects and review revisions.
          </p>

          {connectedWorkspaces.length === 0 ? (
            <div className="space-y-2 rounded-xl border border-dashed p-4 text-center">
              <Link2 className="mx-auto size-4 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">No workspaces linked yet.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!isDraft}
                onClick={() => setConnectOpen(true)}
              >
                Link Workspace
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {connectedWorkspaces.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-2.5 rounded-xl border bg-muted/30 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span className="truncate text-xs font-semibold">{w.name}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {w.workspaceName || "Production"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!isDraft}
                    onClick={() => disconnect(w.id)}
                    className="shrink-0 text-[10px] font-semibold text-destructive hover:underline disabled:opacity-50"
                  >
                    Unlink
                  </button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!isDraft}
                onClick={() => setConnectOpen(true)}
              >
                <Plus className="size-3.5" data-icon="inline-start" /> Link another
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={connectOpen}
        onOpenChange={(o) => {
          setConnectOpen(o);
          if (!o) setConnectingId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editing workspace integrations</DialogTitle>
          </DialogHeader>

          {connectingId ? (
            (() => {
              const target = workspaces.find((w) => w.id === connectingId);
              if (!target) return null;
              return (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-sm font-semibold">Configure {target.name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {target.category}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Workspace / team name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder={`e.g. My ${target.name} Studio`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Authorized editor email</Label>
                    <Input
                      type="email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="editor@studio.com"
                    />
                  </div>
                  <p className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                    <Shield className="mt-0.5 size-4 shrink-0 text-primary" />
                    This lets editors at {memberEmail || "this email"} upload against this
                    submission.
                  </p>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setConnectingId(null)}>
                      Back
                    </Button>
                    <Button type="button" disabled={!teamName.trim() || linking} onClick={confirmConnect}>
                      {linking ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
                      Connect
                    </Button>
                  </DialogFooter>
                </div>
              );
            })()
          ) : (
            <div className="space-y-6">
              {WORKSPACE_CATEGORIES.map((cat) => (
                <div key={cat} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {cat}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {workspaces
                      .filter((w) => w.category === cat)
                      .map((w) => (
                        <div
                          key={w.id}
                          className={cn(
                            "flex flex-col justify-between rounded-2xl border p-4",
                            w.connected && "border-emerald-500/30 bg-emerald-500/5"
                          )}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold">{w.name}</span>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                                  w.connected
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {w.connected ? "Active" : "Offline"}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {w.connected && w.workspaceName ? w.workspaceName : "Remote project share"}
                            </p>
                            <ul className="mt-2 list-inside list-disc space-y-0.5 text-[10px] text-muted-foreground">
                              {w.features.map((f) => (
                                <li key={f} className="truncate">
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t pt-2">
                            {w.connected ? (
                              <>
                                <span className="truncate text-[9px] text-muted-foreground">
                                  {w.connectedEmail || "—"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => disconnect(w.id)}
                                  className="text-[10px] font-semibold text-destructive hover:underline"
                                >
                                  Disconnect
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-[9px] text-muted-foreground">Ready for setup</span>
                                <button
                                  type="button"
                                  onClick={() => openConnect(w.id)}
                                  className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20"
                                >
                                  Connect
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AiButton({
  onClick,
  loading,
  label,
  disabled,
  title,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className="flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Sparkles className="size-3" />
      )}
      {label}
    </button>
  );
}
