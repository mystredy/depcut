"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";
import { categoriesQueryKey } from "@/queries/categories";

export const adminUsersQueryKey = (q?: string) => ["admin", "users", q ?? ""] as const;
export const adminUsageQueryKey = ["admin", "usage"] as const;
export const adminContentProjectsQueryKeyBase = ["admin", "content-projects"] as const;
export const adminContentProjectsQueryKey = (filters: AdminContentProjectFilters = {}) =>
  [...adminContentProjectsQueryKeyBase, filters] as const;
export const adminContentGenerationsQueryKey = (kind: "image" | "video") =>
  ["admin", "content-generations", kind] as const;
export const adminContentAudioQueryKey = (tool?: "text-to-speech" | "dubbing") =>
  ["admin", "content-audio", tool ?? ""] as const;
export const adminUploadsQueryKey = ["admin", "uploads"] as const;
export const adminPaymentMethodsQueryKey = ["admin", "payment-methods"] as const;
export const adminAiModelsQueryKey = ["admin", "ai-models"] as const;
export const adminSettingsQueryKey = ["admin", "settings"] as const;
export const adminSocialAppsQueryKey = ["admin", "social-apps"] as const;
export const adminChatSettingsQueryKey = ["admin", "chat-settings"] as const;
export const adminChatCategoriesQueryKey = ["admin", "chat-categories"] as const;
export const adminChatTemplatesQueryKey = ["admin", "chat-templates"] as const;
export const adminAiEnginesQueryKey = ["admin", "ai-engines"] as const;
export const adminLegalPagesQueryKey = ["admin", "legal-pages"] as const;
export const adminOnboardingSlidesQueryKey = ["admin", "onboarding-slides"] as const;
export const adminFinanceSettingsQueryKey = ["admin", "finance-settings"] as const;
export const adminTelegramNotificationsQueryKey = ["admin", "telegram-notifications"] as const;
export const adminTelegramCommandsQueryKey = ["admin", "telegram-commands"] as const;
export const adminTelegramBotStatsQueryKey = ["admin", "telegram-bot-stats"] as const;
export const adminFinanceExchangeRateQueryKey = ["admin", "finance-exchange-rate"] as const;
export const adminFinanceRatesQueryKey = (q?: string) => ["admin", "finance-rates", q ?? ""] as const;
export const adminFinanceWithdrawalsQueryKey = ["admin", "finance-withdrawals"] as const;
export const adminFinanceTransactionsQueryKey = (filters: {
  user?: string;
  type?: string;
  status?: string;
}) => ["admin", "finance-transactions", filters.user ?? "", filters.type ?? "", filters.status ?? ""] as const;
export const adminFinanceGiveawaysQueryKey = ["admin", "finance-giveaways"] as const;
export const adminFinanceReferralsQueryKey = ["admin", "finance-referrals"] as const;
export const adminFinanceOverviewQueryKey = ["admin", "finance-overview"] as const;
export const adminTasksQueryKey = ["admin", "tasks"] as const;
export const adminAnnouncementsQueryKey = ["admin", "announcements"] as const;
export const adminApiIntegrationsQueryKey = ["admin", "api-integrations"] as const;
export const adminSubmissionsQueryKey = ["admin", "submissions"] as const;
export const adminSocialConnectionsQueryKey = ["admin", "social-connections"] as const;
export const adminBrandsQueryKey = ["admin", "brands"] as const;
export const adminSocialWorkflowsQueryKey = ["admin", "social-workflows"] as const;
export const adminSupportTicketsQueryKey = ["admin", "support-tickets"] as const;

export type AdminChatSettings = {
  id: string;
  defaultModel: string;
  temperature: number;
  maxOutputTokens: number;
  streamOutput: boolean;
  updatedAt: string;
};

export type AdminChatCategory = {
  id: string;
  name: string;
  description: string | null;
  templateCount: number;
};

export type AdminChatTemplate = {
  id: string;
  name: string;
  role: string | null;
  model: string | null;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAiEngine = {
  id: string;
  name: string;
  fallback: string | null;
  latencyNote: string | null;
  priority: number;
  status: string;
};

export type AdminFinanceSettings = {
  id: string;
  minWithdrawal: number;
  processingFeePct: number;
  taxPct: number;
  currency: string;
  paymentWindow: string;
  payoutCycle: string;
  autoTransferDates: string;
  methodBank: boolean;
  methodTonWallet: boolean;
  methodStars: boolean;
  methodCrypto: boolean;
  updatedAt: string;
};

export type AdminTelegramNotificationSettings = {
  id: string;
  notifySubmissions: boolean;
  notifyWithdrawals: boolean;
  notifySupportTickets: boolean;
  notifySignups: boolean;
  notifySystemErrors: boolean;
  updatedAt: string;
};

export type AdminFinanceExchangeRate = {
  id: string;
  currentRate: number;
  effectiveDate: string;
  updatedAt: string;
};

export type AdminFinanceExchangeRateHistoryEntry = {
  id: string;
  rate: number;
  effectiveDate: string;
  authorName: string;
  createdAt: string;
};

export type AdminCreatorRateAccount = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  pending: number;
  available: number;
  referral: number;
  lifetime: number;
};

export type AdminWithdrawal = {
  id: string;
  userId: string;
  userName: string;
  amountRequested: number;
  processingFee: number;
  finalAmount: number;
  method: string;
  destination: string;
  exchangeRateUsed: number;
  status: "Pending" | "Approved" | "Paid" | "Rejected";
  createdAt: string;
  updatedAt: string;
};

export type AdminFinanceTransaction = {
  id: string;
  userId: string | null;
  userName: string;
  type: string;
  ratesAmount: number;
  amount: number;
  status: string;
  details: string | null;
  createdAt: string;
};

export type AdminGiveawayPayment = {
  id: string;
  userId: string;
  userName: string;
  topPosition: string;
  reward: string;
  status: "Pending" | "Paid" | "Rejected";
  paidBy: string | null;
  paidDate: string | null;
  createdAt: string;
};

export type AdminReferralCommission = {
  userId: string;
  userName: string;
  referralCount: number;
  commissionEarned: number;
  commissionPaid: number;
  activeReferrals: number;
  expiredReferrals: number;
  updatedAt: string;
};

export type AdminFinanceOverview = {
  exchangeRate: AdminFinanceExchangeRate;
  settings: AdminFinanceSettings;
  totalPendingRates: number;
  totalAvailableRates: number;
  totalCreatorPayouts: number;
  withdrawalCounts: { pending: number; approved: number; paid: number; rejected: number };
};

export type AdminTask = {
  id: string;
  title: string;
  categoryId: string;
  category: { name: string; emoji: string };
  niche: string | null;
  script: string | null;
  instructions: string | null;
  maxRates: number;
  hoursToComplete: number | null;
  additionalRevenueReward: boolean;
  requiredArtists: string[];
  fullClip: string | null;
  shortClip: string | null;
  status: string;
  claimedById: string | null;
  createdAt: string;
};

export type AdminSubmission = {
  id: string;
  title: string;
  // Set when this came from the editor's Submit button — see
  // Submission.projectId. hasVideo/hasThumbnail are always true for these
  // (there's nothing uploaded to check); review happens against the project.
  projectId: string | null;
  project: { name: string } | null;
  categoryId: string | null;
  category: { name: string; emoji: string } | null;
  status: string | null;
  reviewStatus: string | null;
  statusRemark: string | null;
  reviewRemark: string | null;
  voiceScript: string | null;
  hasThumbnail: boolean;
  hasVideo: boolean;
  maxRates: number | null;
  earnedRates: number | null;
  reviewScore: number | null;
  creatorWorkdone: number | null;
  publisherWorkdone: number | null;
  taskId: string | null;
  task: { id: string; title: string } | null;
  submitterName: string;
  submitterEmail: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewStartedAt: string | null;
  submittedAt: string;
};

export type AdminSocialConnection = {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string | null;
  role: "source" | "destination";
  status: "active" | "inactive";
  hasToken: boolean;
  tokenExpiresAt: string | null;
  brandId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBrandConnection = {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string | null;
};

export type AdminBrand = {
  id: string;
  name: string;
  username: string;
  hasLogo: boolean;
  connections: AdminBrandConnection[];
  createdAt: string;
  updatedAt: string;
};

export type AdminSocialWorkflowConnection = {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string | null;
};

export type AdminSocialWorkflow = {
  id: string;
  name: string;
  sourceConnectionId: string;
  sourceConnection: AdminSocialWorkflowConnection;
  destinationConnectionId: string;
  destinationConnection: AdminSocialWorkflowConnection;
  status: "Active" | "Inactive";
  autoPublish: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminSupportTicket = {
  id: string;
  number: number;
  subject: string;
  message: string;
  status: "Open" | "Investigating" | "Resolved";
  response: string | null;
  raisedByName: string;
  raisedByEmail: string;
  resolvedAt: string | null;
  createdAt: string;
  attachments: { id: string; contentType: string }[];
};

export type AnnouncementTargetType = "all" | "super_users" | "specific_user";

export type AdminAnnouncement = {
  id: string;
  headline: string;
  priority: "Info" | "Warning" | "Critical";
  isPinned: boolean;
  targetType: AnnouncementTargetType;
  // Only meaningful when targetType is "specific_user" — resolve display
  // names against the user list client-side, there's no relation to include.
  targetUserIds: string[];
  status: "Active" | "Scheduled";
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminApiIntegration = {
  id: string;
  provider: string;
  baseUrl: string | null;
  status: "Active" | "Disabled";
  autoFailover: boolean;
  hasApiKey: boolean;
  // Whether the env var the real adapter reads is actually set on this
  // server, and whether any adapter reads it at all — see
  // /api/admin/api-integrations.
  envConfigured: boolean;
  envVarNames: string[];
  wired: boolean;
  updatedAt: string;
};

export type AdminLegalPage = {
  id: string;
  slug: string;
  title: string;
  contentMarkdown: string;
  updatedAt: string;
};

export type AdminOnboardingSlide = {
  id: string;
  slug: string;
  headline: string | null;
  body: string;
  updatedAt: string;
};

export type AdminSettings = {
  id: string;
  appName: string;
  adminEmail: string | null;
  defaultLocale: string;
  timezone: string;
  maintenanceMode: boolean;
  maintenanceHeader: string | null;
  maintenanceParagraph: string | null;
  maintenanceFooter: string | null;
  updatedAt: string;
};

export type AdminSocialApp = {
  id: string;
  platform: string;
  enabled: boolean;
  configuredFields: string[];
  // Saved values for this platform's non-secret ("text") fields only —
  // secret ("password") fields never come back from the server.
  values: Record<string, string>;
  // Whether this platform's real .env vars are set — undefined for
  // platforms with no env mapping (see SOCIAL_APP_ENV_VARS), since this
  // table's own values are storage-only for those.
  envConfigured?: boolean;
  updatedAt: string;
};

export type AdminPaymentMethod = {
  id: string;
  provider: string;
  enabled: boolean;
  hasPublicKey: boolean;
  hasSecretKey: boolean;
  hasPayoutKey: boolean;
  hasWebhookSecret: boolean;
  merchantId: string | null;
  notes: string | null;
  updatedAt: string;
};

export type AdminAiModel = {
  id: string;
  modality: "chat" | "image" | "video" | "audio";
  tier: string;
  label: string;
  modelId: string;
  enabled: boolean;
  updatedAt: string;
};

export type AdminPlatform =
  | "tiktok"
  | "youtube"
  | "facebook"
  | "instagram"
  | "threads"
  | "snapchat"
  | "x";

export type AdminPost = {
  id: string;
  uploadId: string;
  postTime: string | null;
  platform: string | null;
  shortLink: boolean;
  text: string | null;
  mediaUrls: string | null;
  state: "scheduled" | "published" | "failed";
  postUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUpload = {
  id: string;
  title: string;
  description: string | null;
  tags: string | null;
  status: string;
  createdAt: string;
  submission: { id: string; title: string; user: { email: string } } | null;
  posts: AdminPost[];
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  image: string | null;
  superUser: boolean;
  balance: string;
  lifetimeGranted: string;
  lifetimeCharged: string;
  createdAt: string;
  /** Most recent session's own updatedAt — null if the account never signed
   * in (a super user created directly, or a signup that never completed). */
  lastActiveAt: string | null;
};

export type AdminUsage = {
  totals: {
    userCount: number;
    /** Distinct users with a session touched in the last 24h — see the
     * route's own comment on how coarse that signal is. */
    activeUserCount: number;
    balance: string;
    lifetimeGranted: string;
    lifetimeCharged: string;
  };
  last30Days: {
    totalCharged: string;
    breakdown: {
      route: string;
      provider: string;
      model: string;
      count: number;
      failedCount: number;
      creditsCharged: string;
    }[];
  };
};

// Super-user only. Every hook here 403s server-side for anyone else — the
// admin UI additionally hides itself behind AdminGuard, but the routes are
// the real gate.
export function useAdminUsers(q: string) {
  return useQuery({
    queryFn: () =>
      apiFetch<{ users: AdminUser[] }>(
        `/api/admin/users${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
      ),
    queryKey: adminUsersQueryKey(q.trim()),
  });
}

export function useSetSuperUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, superUser }: { userId: string; superUser: boolean }) =>
      apiFetch<{ user: { id: string; email: string; superUser: boolean } }>(
        `/api/admin/users/${userId}`,
        { body: JSON.stringify({ superUser }), method: "PATCH" },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdminUsage() {
  return useQuery({
    queryFn: () => apiFetch<AdminUsage>("/api/admin/usage"),
    queryKey: adminUsageQueryKey,
  });
}

export type AdminContentOwner = { id: string; name: string; displayName: string | null; email: string; image: string | null };

export type AdminContentProject = {
  id: string;
  userId: string;
  name: string;
  previewUrl: string | null;
  previewIsImage: boolean;
  previewStart: number;
  hasExported: boolean;
  createdAt: string;
  updatedAt: string;
  owner: AdminContentOwner | null;
};

export type AdminContentProjectFilters = {
  q?: string;
  owner?: string;
  exported?: "yes" | "no";
  /** ISO date strings (yyyy-mm-dd from a plain <input type="date">). */
  from?: string;
  to?: string;
};

function contentProjectsQueryString(filters: AdminContentProjectFilters): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.owner?.trim()) params.set("owner", filters.owner.trim());
  if (filters.exported) params.set("exported", filters.exported);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useAdminContentProjects(filters: AdminContentProjectFilters = {}) {
  return useQuery({
    queryFn: () =>
      apiFetch<{ items: AdminContentProject[] }>(
        `/api/admin/content/projects${contentProjectsQueryString(filters)}`,
      ),
    queryKey: adminContentProjectsQueryKey(filters),
  });
}

/** Clone any account's project into the admin's own — POST queues the copy
 * job (same pipeline an owner's own "Duplicate" uses), then this polls the
 * existing owner-scoped job-status route every 2s until it settles. Mirrors
 * ProjectsHome.tsx's own duplicate() polling loop; here the "owner" polling
 * is the admin, since the job's destination account is the admin's. */
export function useAdminCloneProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { jobId } = await apiFetch<{ jobId: string }>(
        `/api/admin/content/projects/${projectId}/clone`,
        { method: "POST" },
      );
      for (;;) {
        await new Promise((done) => setTimeout(done, 2000));
        const job = await apiFetch<{ state: string; newProjectId?: string; error?: string }>(
          `/api/cut-cloud/copy-jobs/${jobId}`,
        );
        if (job.state === "done") return { newProjectId: job.newProjectId };
        if (job.state === "error") throw new Error(job.error || "Could not clone the project.");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminContentProjectsQueryKeyBase }),
  });
}

/** Delete any account's project — the Content → Projects list's right-click
 * "Delete project" action. Irreversible, same as an owner's own delete. */
export function useAdminDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<{ ok: true }>(`/api/admin/content/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminContentProjectsQueryKeyBase }),
  });
}

export type AdminContentGeneration = {
  id: string;
  userId: string;
  flowId: string;
  kind: string;
  prompt: string;
  provider: string;
  model: string;
  outputUrl: string | null;
  posterUrl: string | null;
  createdAt: string;
  owner: AdminContentOwner | null;
};

export function useAdminContentGenerations(kind: "image" | "video") {
  return useQuery({
    queryFn: () =>
      apiFetch<{ items: AdminContentGeneration[] }>(`/api/admin/content/generations?kind=${kind}`),
    queryKey: adminContentGenerationsQueryKey(kind),
  });
}

export type AdminContentAudio = {
  id: string;
  userId: string;
  tool: string;
  script: string;
  direction: string | null;
  voice: string;
  language: string | null;
  sourceLabel: string | null;
  transcript: string | null;
  targetLanguage: string | null;
  outputUrl: string;
  outputMime: string;
  durationSeconds: number | null;
  createdAt: string;
  owner: AdminContentOwner | null;
};

export function useAdminContentAudio(tool?: "text-to-speech" | "dubbing") {
  return useQuery({
    queryFn: () =>
      apiFetch<{ items: AdminContentAudio[] }>(
        `/api/admin/content/audio${tool ? `?tool=${tool}` : ""}`,
      ),
    queryKey: adminContentAudioQueryKey(tool),
  });
}

export function useAdminUploads() {
  return useQuery({
    queryFn: () => apiFetch<{ uploads: AdminUpload[] }>("/api/admin/uploads"),
    queryKey: adminUploadsQueryKey,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      uploadId,
      ...input
    }: {
      uploadId: string;
      platform: AdminPlatform;
      text?: string;
      mediaUrls?: string;
    }) =>
      apiFetch<{ post: AdminPost }>(`/api/admin/uploads/${uploadId}/posts`, {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminUploadsQueryKey }),
  });
}

export type UpdatePostStateInput =
  | { postId: string; state: "scheduled" }
  | { postId: string; state: "published"; postUrl: string }
  | { postId: string; state: "failed"; errorMessage: string };

export function useUpdatePostState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, ...body }: UpdatePostStateInput) =>
      apiFetch<{ post: AdminPost }>(`/api/admin/posts/${postId}`, {
        body: JSON.stringify(body),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminUploadsQueryKey }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      ...input
    }: {
      categoryId: string;
      emoji?: string;
      niches?: string;
    }) =>
      apiFetch<{ category: { id: string } }>(`/api/admin/categories/${categoryId}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; emoji: string }) =>
      apiFetch<{ category: { id: string } }>("/api/admin/categories", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/categories/${categoryId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
  });
}

export function useAdminPaymentMethods() {
  return useQuery({
    queryFn: () =>
      apiFetch<{ paymentMethods: AdminPaymentMethod[] }>("/api/admin/payment-methods"),
    queryKey: adminPaymentMethodsQueryKey,
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      enabled?: boolean;
      publicKey?: string;
      secretKey?: string;
      payoutKey?: string;
      merchantId?: string;
      webhookSecret?: string;
      notes?: string;
    }) =>
      apiFetch<{ paymentMethod: AdminPaymentMethod }>(`/api/admin/payment-methods/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminPaymentMethodsQueryKey }),
  });
}

export function useAdminAiModels() {
  return useQuery({
    queryFn: () => apiFetch<{ models: AdminAiModel[] }>("/api/admin/ai-models"),
    queryKey: adminAiModelsQueryKey,
  });
}

export function useUpdateAiModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; enabled?: boolean; label?: string }) =>
      apiFetch<{ model: AdminAiModel }>(`/api/admin/ai-models/${id}`, {
        body: JSON.stringify(patch),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAiModelsQueryKey }),
  });
}

export function useCreateAiModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      modality: AdminAiModel["modality"];
      tier: string;
      label: string;
      modelId: string;
    }) =>
      apiFetch<{ model: AdminAiModel }>("/api/admin/ai-models", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAiModelsQueryKey }),
  });
}

export type ProviderCatalogModel = { id: string; name: string };

// Live discovery for the Add-model dialog's provider step, narrowed server-side
// to the modality being added — null while no provider is picked yet, so the
// query stays disabled instead of firing on mount.
export function useProviderModels(provider: string | null, modality: AdminAiModel["modality"]) {
  return useQuery({
    enabled: provider !== null,
    queryFn: () =>
      apiFetch<{ models: ProviderCatalogModel[] }>(
        `/api/admin/ai-models/provider-models?provider=${encodeURIComponent(provider ?? "")}&modality=${modality}`
      ),
    queryKey: ["admin", "ai-models", "provider-models", provider, modality] as const,
  });
}

export function useAdminSettings() {
  return useQuery({
    queryFn: () => apiFetch<{ settings: AdminSettings }>("/api/admin/settings"),
    queryKey: adminSettingsQueryKey,
  });
}

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Partial<
        Pick<
          AdminSettings,
          | "appName"
          | "adminEmail"
          | "defaultLocale"
          | "timezone"
          | "maintenanceMode"
          | "maintenanceHeader"
          | "maintenanceParagraph"
          | "maintenanceFooter"
        >
      >
    ) =>
      apiFetch<{ settings: AdminSettings }>("/api/admin/settings", {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSettingsQueryKey }),
  });
}

export function useAdminSocialApps() {
  return useQuery({
    queryFn: () => apiFetch<{ socialApps: AdminSocialApp[] }>("/api/admin/social-apps"),
    queryKey: adminSocialAppsQueryKey,
  });
}

export function useUpdateSocialApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      enabled?: boolean;
      credentials?: Record<string, string>;
    }) =>
      apiFetch<{ socialApp: AdminSocialApp }>(`/api/admin/social-apps/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSocialAppsQueryKey }),
  });
}

// Fetches one secret field's real value on demand — only called when an
// admin explicitly clicks "reveal" for that field. Not cached under the main
// social-apps query key, so it never lingers from a routine list refetch.
export function useRevealSocialAppField() {
  return useMutation({
    mutationFn: ({ id, field }: { id: string; field: string }) =>
      apiFetch<{ value: string | null }>(
        `/api/admin/social-apps/${id}/reveal?field=${encodeURIComponent(field)}`
      ),
  });
}

export function useAdminChatSettings() {
  return useQuery({
    queryFn: () => apiFetch<{ settings: AdminChatSettings }>("/api/admin/chat-settings"),
    queryKey: adminChatSettingsQueryKey,
  });
}

export function useUpdateChatSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Partial<
        Pick<AdminChatSettings, "defaultModel" | "temperature" | "maxOutputTokens" | "streamOutput">
      >
    ) =>
      apiFetch<{ settings: AdminChatSettings }>("/api/admin/chat-settings", {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminChatSettingsQueryKey }),
  });
}

export function useAdminChatCategories() {
  return useQuery({
    queryFn: () =>
      apiFetch<{ categories: AdminChatCategory[] }>("/api/admin/chat-categories"),
    queryKey: adminChatCategoriesQueryKey,
  });
}

export function useCreateChatCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      apiFetch<{ category: AdminChatCategory }>("/api/admin/chat-categories", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminChatCategoriesQueryKey }),
  });
}

export function useAdminChatTemplates() {
  return useQuery({
    queryFn: () => apiFetch<{ templates: AdminChatTemplate[] }>("/api/admin/chat-templates"),
    queryKey: adminChatTemplatesQueryKey,
  });
}

export function useCreateChatTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; role?: string; model?: string; categoryId?: string }) =>
      apiFetch<{ template: AdminChatTemplate }>("/api/admin/chat-templates", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminChatTemplatesQueryKey }),
  });
}

export function useUpdateChatTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      role?: string;
      model?: string;
      categoryId?: string | null;
    }) =>
      apiFetch<{ template: AdminChatTemplate }>(`/api/admin/chat-templates/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminChatTemplatesQueryKey }),
  });
}

export function useAdminAiEngines() {
  return useQuery({
    queryFn: () => apiFetch<{ engines: AdminAiEngine[] }>("/api/admin/ai-engines"),
    queryKey: adminAiEnginesQueryKey,
  });
}

export function useUpdateAiEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      status?: "active" | "standby";
      escalate?: boolean;
    }) =>
      apiFetch<{ engine: AdminAiEngine }>(`/api/admin/ai-engines/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAiEnginesQueryKey }),
  });
}

export function useAdminFinanceOverview() {
  return useQuery({
    queryFn: () => apiFetch<AdminFinanceOverview>("/api/admin/finance/overview"),
    queryKey: adminFinanceOverviewQueryKey,
  });
}

export function useAdminFinanceSettings() {
  return useQuery({
    queryFn: () => apiFetch<{ settings: AdminFinanceSettings }>("/api/admin/finance/settings"),
    queryKey: adminFinanceSettingsQueryKey,
  });
}

export function useUpdateFinanceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<AdminFinanceSettings, "id" | "updatedAt">>) =>
      apiFetch<{ settings: AdminFinanceSettings }>("/api/admin/finance/settings", {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminFinanceSettingsQueryKey }),
  });
}

export function useAdminTelegramNotifications() {
  return useQuery({
    queryFn: () =>
      apiFetch<{ settings: AdminTelegramNotificationSettings }>("/api/admin/telegram-notifications"),
    queryKey: adminTelegramNotificationsQueryKey,
  });
}

export function useUpdateTelegramNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<AdminTelegramNotificationSettings, "id" | "updatedAt">>) =>
      apiFetch<{ settings: AdminTelegramNotificationSettings }>("/api/admin/telegram-notifications", {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminTelegramNotificationsQueryKey }),
  });
}

export type AdminTelegramCommand = {
  id: string;
  trigger: string;
  replyText: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export function useAdminTelegramCommands() {
  return useQuery({
    queryFn: () => apiFetch<{ commands: AdminTelegramCommand[] }>("/api/admin/telegram-commands"),
    queryKey: adminTelegramCommandsQueryKey,
  });
}

export function useCreateTelegramCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { trigger: string; replyText: string; enabled?: boolean }) =>
      apiFetch<{ command: AdminTelegramCommand }>("/api/admin/telegram-commands", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminTelegramCommandsQueryKey }),
  });
}

export function useUpdateTelegramCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      trigger?: string;
      replyText?: string;
      enabled?: boolean;
    }) =>
      apiFetch<{ command: AdminTelegramCommand }>(`/api/admin/telegram-commands/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminTelegramCommandsQueryKey }),
  });
}

export function useDeleteTelegramCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/admin/telegram-commands/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminTelegramCommandsQueryKey }),
  });
}

export function useConnectTelegramWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ url: string }>("/api/admin/telegram-webhook/connect", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminTelegramBotStatsQueryKey }),
  });
}

export type AdminTelegramBotStats = {
  users: number;
  commands: number;
  webhookConnectedAt: string | null;
};

export function useAdminTelegramBotStats() {
  return useQuery({
    queryFn: () => apiFetch<AdminTelegramBotStats>("/api/admin/telegram-bot-stats"),
    queryKey: adminTelegramBotStatsQueryKey,
  });
}

export function useAdminFinanceExchangeRate() {
  return useQuery({
    queryFn: () =>
      apiFetch<{ exchangeRate: AdminFinanceExchangeRate; history: AdminFinanceExchangeRateHistoryEntry[] }>(
        "/api/admin/finance/exchange-rate"
      ),
    queryKey: adminFinanceExchangeRateQueryKey,
  });
}

export function useUpdateFinanceExchangeRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { rate: number; effectiveDate: string }) =>
      apiFetch<{ exchangeRate: AdminFinanceExchangeRate; history: AdminFinanceExchangeRateHistoryEntry[] }>(
        "/api/admin/finance/exchange-rate",
        { body: JSON.stringify(input), method: "PATCH" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminFinanceExchangeRateQueryKey });
      queryClient.invalidateQueries({ queryKey: adminFinanceOverviewQueryKey });
    },
  });
}

export function useAdminFinanceRates(q: string) {
  return useQuery({
    queryFn: () =>
      apiFetch<{ accounts: AdminCreatorRateAccount[] }>(
        `/api/admin/finance/rates${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`
      ),
    queryKey: adminFinanceRatesQueryKey(q.trim()),
  });
}

export type AdjustCreatorRateInput =
  | { userId: string; action: "reset-pending" | "reset-available" | "transfer-pending-to-available" }
  | {
      userId: string;
      action: "adjust";
      field: "pending" | "available";
      direction: "add" | "deduct";
      amount: number;
    };

export function useAdjustCreatorRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustCreatorRateInput) =>
      apiFetch<{ account: AdminCreatorRateAccount }>("/api/admin/finance/rates", {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-rates"] });
      queryClient.invalidateQueries({ queryKey: adminFinanceOverviewQueryKey });
    },
  });
}

export function useAdminFinanceWithdrawals() {
  return useQuery({
    queryFn: () => apiFetch<{ withdrawals: AdminWithdrawal[] }>("/api/admin/finance/withdrawals"),
    queryKey: adminFinanceWithdrawalsQueryKey,
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      amountRequested: number;
      method: string;
      destination: string;
    }) =>
      apiFetch<{ withdrawal: AdminWithdrawal }>("/api/admin/finance/withdrawals", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminFinanceWithdrawalsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-rates"] });
      queryClient.invalidateQueries({ queryKey: adminFinanceOverviewQueryKey });
    },
  });
}

export function useUpdateWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Paid" | "Rejected" }) =>
      apiFetch<{ withdrawal: AdminWithdrawal }>(`/api/admin/finance/withdrawals/${id}`, {
        body: JSON.stringify({ status }),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminFinanceWithdrawalsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-rates"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-transactions"] });
      queryClient.invalidateQueries({ queryKey: adminFinanceOverviewQueryKey });
    },
  });
}

export function useBulkPayWithdrawals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ paidCount: number }>("/api/admin/finance/withdrawals/bulk-pay", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminFinanceWithdrawalsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-transactions"] });
      queryClient.invalidateQueries({ queryKey: adminFinanceOverviewQueryKey });
    },
  });
}

export function useAdminFinanceTransactions(filters: { user?: string; type?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters.user) params.set("user", filters.user);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();

  return useQuery({
    queryFn: () =>
      apiFetch<{ transactions: AdminFinanceTransaction[] }>(
        `/api/admin/finance/transactions${qs ? `?${qs}` : ""}`
      ),
    queryKey: adminFinanceTransactionsQueryKey(filters),
  });
}

export function useAdminFinanceGiveaways() {
  return useQuery({
    queryFn: () => apiFetch<{ giveaways: AdminGiveawayPayment[] }>("/api/admin/finance/giveaways"),
    queryKey: adminFinanceGiveawaysQueryKey,
  });
}

export function useCreateGiveaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; topPosition: string; reward: string }) =>
      apiFetch<{ giveaway: AdminGiveawayPayment }>("/api/admin/finance/giveaways", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminFinanceGiveawaysQueryKey }),
  });
}

export function useUpdateGiveaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Paid" | "Rejected" }) =>
      apiFetch<{ giveaway: AdminGiveawayPayment }>(`/api/admin/finance/giveaways/${id}`, {
        body: JSON.stringify({ status }),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminFinanceGiveawaysQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-transactions"] });
    },
  });
}

export function useAdminFinanceReferrals() {
  return useQuery({
    queryFn: () => apiFetch<{ referrals: AdminReferralCommission[] }>("/api/admin/finance/referrals"),
    queryKey: adminFinanceReferralsQueryKey,
  });
}

export function useUpsertReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      referralCount: number;
      commissionEarned: number;
      activeReferrals: number;
      expiredReferrals: number;
    }) =>
      apiFetch<{ referral: AdminReferralCommission }>("/api/admin/finance/referrals", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminFinanceReferralsQueryKey }),
  });
}

export function useSettleReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ referral: AdminReferralCommission }>(`/api/admin/finance/referrals/${userId}`, {
        body: JSON.stringify({ action: "settle" }),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminFinanceReferralsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-transactions"] });
    },
  });
}

export function useAdminTasks() {
  return useQuery({
    queryFn: () => apiFetch<{ tasks: AdminTask[] }>("/api/admin/tasks"),
    queryKey: adminTasksQueryKey,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      categoryId: string;
      niche?: string;
      script?: string;
      instructions?: string;
      maxRates: number;
      hoursToComplete: number;
      additionalRevenueReward: boolean;
      requiredArtists: string[];
      fullClip?: string;
      shortClip?: string;
    }) =>
      apiFetch<{ task: AdminTask }>("/api/admin/tasks", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminTasksQueryKey }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminTasksQueryKey }),
  });
}

export function useAdminSubmissions() {
  return useQuery({
    queryFn: () => apiFetch<{ submissions: AdminSubmission[] }>("/api/admin/submissions"),
    queryKey: adminSubmissionsQueryKey,
  });
}

export type ReviewSubmissionAction =
  | { id: string; action: "start-review" }
  | { id: string; action: "approve"; reviewScore: number; creatorWorkdone?: number; remark?: string }
  | { id: string; action: "reject"; remark?: string };

export function useReviewSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ReviewSubmissionAction) =>
      apiFetch<{ submission: AdminSubmission }>(`/api/admin/submissions/${id}`, {
        body: JSON.stringify(body),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSubmissionsQueryKey }),
  });
}

export function useAdminSocialConnections() {
  return useQuery({
    queryFn: () =>
      apiFetch<{ connections: AdminSocialConnection[] }>("/api/admin/social-connections"),
    queryKey: adminSocialConnectionsQueryKey,
  });
}

export function useCreateSocialConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      platform: string;
      accountName: string;
      accountHandle?: string;
      role?: "source" | "destination";
      tokenExpiresAt?: string;
    }) =>
      apiFetch<{ connection: AdminSocialConnection }>("/api/admin/social-connections", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSocialConnectionsQueryKey }),
  });
}

export function useUpdateSocialConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      status?: "active" | "inactive";
      brandId?: string | null;
    }) =>
      apiFetch<{ connection: AdminSocialConnection }>(`/api/admin/social-connections/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSocialConnectionsQueryKey });
      queryClient.invalidateQueries({ queryKey: adminBrandsQueryKey });
    },
  });
}

export function useAdminBrands() {
  return useQuery({
    queryFn: () => apiFetch<{ brands: AdminBrand[] }>("/api/admin/brands"),
    queryKey: adminBrandsQueryKey,
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; username: string }) =>
      apiFetch<{ brand: AdminBrand }>("/api/admin/brands", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminBrandsQueryKey }),
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; username?: string }) =>
      apiFetch<{ brand: AdminBrand }>(`/api/admin/brands/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminBrandsQueryKey }),
  });
}

// Uploaded as a raw PUT (same pattern as the account avatar route), not a
// JSON field — the blob is already a client-side downscaled image.
export function useUploadBrandLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, blob }: { id: string; blob: Blob }) => {
      const res = await fetch(`/api/admin/brands/${id}/logo`, {
        body: blob,
        headers: { "Content-Type": blob.type },
        method: "PUT",
      });
      if (!res.ok) throw new Error("Couldn't upload that logo — try again.");
      return res.json() as Promise<{ updatedAt: string }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminBrandsQueryKey }),
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/api/admin/brands/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminBrandsQueryKey });
      queryClient.invalidateQueries({ queryKey: adminSocialConnectionsQueryKey });
    },
  });
}

export function useDeleteSocialConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/social-connections/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSocialConnectionsQueryKey }),
  });
}

export function useAdminSocialWorkflows() {
  return useQuery({
    queryFn: () => apiFetch<{ workflows: AdminSocialWorkflow[] }>("/api/admin/social-workflows"),
    queryKey: adminSocialWorkflowsQueryKey,
  });
}

export function useCreateSocialWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      sourceConnectionId: string;
      destinationConnectionId: string;
      autoPublish?: boolean;
    }) =>
      apiFetch<{ workflow: AdminSocialWorkflow }>("/api/admin/social-workflows", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSocialWorkflowsQueryKey }),
  });
}

export function useUpdateSocialWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      status?: "Active" | "Inactive";
      autoPublish?: boolean;
    }) =>
      apiFetch<{ workflow: AdminSocialWorkflow }>(`/api/admin/social-workflows/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSocialWorkflowsQueryKey }),
  });
}

export function useDeleteSocialWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/social-workflows/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSocialWorkflowsQueryKey }),
  });
}

export function useAdminSupportTickets() {
  return useQuery({
    queryFn: () => apiFetch<{ tickets: AdminSupportTicket[] }>("/api/admin/support-tickets"),
    queryKey: adminSupportTicketsQueryKey,
  });
}

export function useReplySupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; response: string; status: "Resolved" }) =>
      apiFetch<{ ticket: AdminSupportTicket }>(`/api/admin/support-tickets/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSupportTicketsQueryKey }),
  });
}

export function useUpdateSupportTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Open" | "Investigating" }) =>
      apiFetch<{ ticket: AdminSupportTicket }>(`/api/admin/support-tickets/${id}`, {
        body: JSON.stringify({ status }),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSupportTicketsQueryKey }),
  });
}

export function useAdminAnnouncements() {
  return useQuery({
    queryFn: () => apiFetch<{ announcements: AdminAnnouncement[] }>("/api/admin/announcements"),
    queryKey: adminAnnouncementsQueryKey,
  });
}

export type AnnouncementInput = {
  headline: string;
  priority: "Info" | "Warning" | "Critical";
  isPinned: boolean;
  targetType: AnnouncementTargetType;
  targetUserIds?: string[];
  scheduledAt?: string;
};

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementInput) =>
      apiFetch<{ announcement: AdminAnnouncement }>("/api/admin/announcements", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKey }),
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<AnnouncementInput> & { id: string }) =>
      apiFetch<{ announcement: AdminAnnouncement }>(`/api/admin/announcements/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKey }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKey }),
  });
}

export function useAdminApiIntegrations() {
  return useQuery({
    queryFn: () => apiFetch<{ integrations: AdminApiIntegration[] }>("/api/admin/api-integrations"),
    queryKey: adminApiIntegrationsQueryKey,
  });
}

export function useUpdateApiIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      apiKey?: string;
      baseUrl?: string;
      status?: "Active" | "Disabled";
      autoFailover?: boolean;
    }) =>
      apiFetch<{ integration: AdminApiIntegration }>(`/api/admin/api-integrations/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminApiIntegrationsQueryKey }),
  });
}

export function useRevealApiIntegrationKey() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ value: string | null }>(`/api/admin/api-integrations/${id}/reveal`),
  });
}

export function useAdminLegalPages() {
  return useQuery({
    queryFn: () => apiFetch<{ pages: AdminLegalPage[] }>("/api/admin/legal-pages"),
    queryKey: adminLegalPagesQueryKey,
  });
}

export function useUpdateLegalPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; title?: string; contentMarkdown?: string }) =>
      apiFetch<{ page: AdminLegalPage }>(`/api/admin/legal-pages/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminLegalPagesQueryKey }),
  });
}

export function useAdminOnboardingSlides() {
  return useQuery({
    queryFn: () => apiFetch<{ slides: AdminOnboardingSlide[] }>("/api/admin/onboarding-slides"),
    queryKey: adminOnboardingSlidesQueryKey,
  });
}

export function useUpdateOnboardingSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; headline?: string | null; body?: string }) =>
      apiFetch<{ slide: AdminOnboardingSlide }>(`/api/admin/onboarding-slides/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminOnboardingSlidesQueryKey }),
  });
}
