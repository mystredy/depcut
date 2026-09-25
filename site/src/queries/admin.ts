"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";
import { categoriesQueryKey } from "@/queries/categories";

export const adminUsersQueryKey = (q?: string) => ["admin", "users", q ?? ""] as const;
export const adminUsageQueryKey = ["admin", "usage"] as const;
export const adminUserUsageQueryKey = (userId: string) => ["admin", "user-usage", userId] as const;
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
export const adminBlogPostsQueryKey = ["admin", "blog-posts"] as const;
export const adminBlogChatThreadsQueryKey = (postId: string) => ["admin", "blog-chat-threads", postId] as const;
export const adminOnboardingSlidesQueryKey = ["admin", "onboarding-slides"] as const;
export const adminFinanceSettingsQueryKey = ["admin", "finance-settings"] as const;
export const adminTelegramNotificationsQueryKey = ["admin", "telegram-notifications"] as const;
export const adminTelegramCommandsQueryKey = ["admin", "telegram-commands"] as const;
export const adminTelegramBotStatsQueryKey = ["admin", "telegram-bot-stats"] as const;
export const adminFinanceExchangeRateQueryKey = ["admin", "finance-exchange-rate"] as const;
export const adminFinanceRatesQueryKey = (q?: string) => ["admin", "finance-rates", q ?? ""] as const;
export const adminAiPricingQueryKey = ["admin", "ai-pricing"] as const;
export const adminFinancePayoutsQueryKey = (q?: string) => ["admin", "finance-payouts", q ?? ""] as const;
export const adminFinanceWithdrawalsQueryKey = ["admin", "finance-withdrawals"] as const;
export const adminFinanceTransactionsQueryKey = (filters: {
  user?: string;
  type?: string;
  status?: string;
}) => ["admin", "finance-transactions", filters.user ?? "", filters.type ?? "", filters.status ?? ""] as const;
export const adminFinanceGiveawaysQueryKey = ["admin", "finance-giveaways"] as const;
export const adminFinanceReferralsQueryKey = ["admin", "finance-referrals"] as const;
export const adminFinanceAffiliatesQueryKey = ["admin", "finance-affiliates"] as const;
export const adminFinanceOverviewQueryKey = ["admin", "finance-overview"] as const;
export const adminCreatorApplicationsQueryKey = ["admin", "creator-applications"] as const;
export const adminTasksQueryKey = ["admin", "tasks"] as const;
export const adminAnnouncementsQueryKey = ["admin", "announcements"] as const;
export const adminApiIntegrationsQueryKey = ["admin", "api-integrations"] as const;
export const adminSubmissionsQueryKey = ["admin", "submissions"] as const;
export const adminSocialConnectionsQueryKey = ["admin", "social-connections"] as const;
export const adminBrandsQueryKey = ["admin", "brands"] as const;
export const adminArtistStudioAssignmentsQueryKey = (userId: string) =>
  ["admin", "artist-studio-assignments", userId] as const;
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
  affiliateCommissionRates: number;
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

// A creator's Payout (USD) balance — separate from AdminArtistRateAccount's
// Rates balance below. Only this is ever drawn down by a real Withdrawal.
export type AdminPayoutAccount = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  available: number;
  lifetime: number;
};

export type AdminArtistRateAccount = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  pending: number;
  available: number;
  referral: number;
  lifetime: number;
  // "Standard" | "Pro".
  tier: string;
  // False for a former artist — access was revoked, but the row (and
  // balance history) stays so they still show up here.
  active: boolean;
};

export type AdminCreatorApplication = {
  userId: string;
  applicantName: string;
  applicantEmail: string;
  reason: string;
  portfolio: string | null;
  status: "Pending" | "Approved" | "Rejected";
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export type AdminAffiliate = {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  code: string;
  referralCount: number;
  totalCommissionRates: number;
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
  // Sum of every PayoutAccount.available (USD) — what Withdrawals actually
  // draw from, separate from the Rates totals above.
  totalPayoutAvailable: number;
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
  platformAccountId: string | null;
  accountName: string;
  accountHandle: string | null;
  profileImage: string | null;
  role: "source" | "destination";
  status: "active" | "inactive";
  hasToken: boolean;
  hasRefreshToken: boolean;
  tokenExpiresAt: string | null;
  brandId: string | null;
  // Set when a DepCut user connected this account themselves; null for the
  // admin-managed shared pool.
  userId: string | null;
  studioId: string | null;
  studioName: string | null;
  // The studio's owner for a studio-owned connection, else the direct user
  // above; null for the admin-managed shared pool (no studio, no user).
  ownerName: string | null;
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

export type AdminSupportMessage = {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  createdAt: string;
  attachments: { id: string; contentType: string }[];
};

export type AdminSupportTicket = {
  id: string;
  number: number;
  subject: string;
  status: "Open" | "Investigating" | "Answered" | "Closed";
  priority: "Low" | "Medium" | "High";
  raisedByName: string;
  raisedByEmail: string;
  lastReplyAt: string | null;
  createdAt: string;
  messages: AdminSupportMessage[];
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

export type SiteSocialLinks = {
  discord?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
  x?: string;
  youtube?: string;
};

export type AdminSettings = {
  id: string;
  appName: string;
  tagline: string | null;
  description: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  contactEmail: string | null;
  adminEmail: string | null;
  defaultLocale: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  defaultTheme: string;
  accentColor: string | null;
  copyrightText: string | null;
  footerText: string | null;
  maintenanceMode: boolean;
  maintenanceHeader: string | null;
  maintenanceParagraph: string | null;
  maintenanceFooter: string | null;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  defaultUserRole: string;
  termsUrl: string | null;
  privacyUrl: string | null;
  cookiePolicyUrl: string | null;
  helpCenterUrl: string | null;
  socialLinks: SiteSocialLinks | null;
  betaMode: boolean;
  creditRateCredits: number;
  creditRateDollars: number;
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
  isArtist: boolean;
  // "Standard" | "Pro" | null — null when not an artist.
  creatorTier: string | null;
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

export type AdminUserUsageEvent = {
  createdAt: string;
  requestKind: string;
  model: string;
  costCredits: string;
  status: string;
  errorCode: string | null;
};

// One account's own inference usage — the "..." menu's "Usage" item on the
// AI Credits balances table. `enabled: !!userId` so the dialog only fetches
// once a target row is picked.
export function useAdminUserUsage(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryFn: () => apiFetch<{ events: AdminUserUsageEvent[] }>(`/api/admin/users/${userId}/usage`),
    queryKey: adminUserUsageQueryKey(userId ?? ""),
  });
}

// "grant-super-user" | "revoke-super-user" — mirrors lib/admin/action-verification.ts's
// AdminAction, kept as its own literal union here since that module is
// server-only (node:crypto) and can't be imported into client code.
export type AdminUserAction = "grant-super-user" | "revoke-super-user";

export function useRequestActionCode() {
  return useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: AdminUserAction }) =>
      apiFetch<{ challenge: string; sentTo: string }>(
        `/api/admin/users/${userId}/action-code`,
        { body: JSON.stringify({ action }), method: "POST" },
      ),
  });
}

export function useSetSuperUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      superUser,
      challenge,
      code,
    }: {
      userId: string;
      superUser: boolean;
      challenge: string;
      code: string;
    }) =>
      apiFetch<{ user: { id: string; email: string; superUser: boolean } }>(
        `/api/admin/users/${userId}`,
        { body: JSON.stringify({ challenge, code, superUser }), method: "PATCH" },
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
    mutationFn: (input: Partial<Omit<AdminSettings, "id" | "updatedAt">>) =>
      apiFetch<{ settings: AdminSettings }>("/api/admin/settings", {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSettingsQueryKey }),
  });
}

// Site branding (admin/settings/general): a logo per theme (plus the
// collapsed-sidebar compact mark), the favicon, the apple touch icon, and
// the social share image. Each lives on its own route — the logo family is
// public (/api/site/logo/[theme]; SiteLogo reads it from every surface,
// signed in or not) while the rest write-only admin routes back the /icon,
// /apple-icon, and /opengraph-image conventions instead — so uploading or
// removing one never touches the general settings payload; callers refetch
// their own preview image rather than invalidating adminSettingsQueryKey.
export function useUploadSiteLogo(theme: "light" | "dark" | "compact") {
  return useMutation({
    mutationFn: (file: File) =>
      apiFetch<{ ok: true }>(`/api/site/logo/${theme}`, {
        body: file,
        headers: { "Content-Type": file.type },
        method: "PUT",
      }),
  });
}

export function useRemoveSiteLogo(theme: "light" | "dark" | "compact") {
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>(`/api/site/logo/${theme}`, { method: "DELETE" }),
  });
}

function useUploadBrandingImage(path: string) {
  return useMutation({
    mutationFn: (file: File) =>
      apiFetch<{ ok: true }>(path, {
        body: file,
        headers: { "Content-Type": file.type },
        method: "PUT",
      }),
  });
}

function useRemoveBrandingImage(path: string) {
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>(path, { method: "DELETE" }),
  });
}

// One dynamic route (branding-image/[asset]) backs all three — see that
// route's own comment for why (the Hobby-plan serverless function ceiling,
// docs/guides/vercel-function-budget.md).
export const useUploadFavicon = () =>
  useUploadBrandingImage("/api/admin/settings/branding-image/favicon");
export const useRemoveFavicon = () =>
  useRemoveBrandingImage("/api/admin/settings/branding-image/favicon");

export const useUploadAppleTouchIcon = () =>
  useUploadBrandingImage("/api/admin/settings/branding-image/apple-touch-icon");
export const useRemoveAppleTouchIcon = () =>
  useRemoveBrandingImage("/api/admin/settings/branding-image/apple-touch-icon");

export const useUploadSocialShareImage = () =>
  useUploadBrandingImage("/api/admin/settings/branding-image/social-share-image");
export const useRemoveSocialShareImage = () =>
  useRemoveBrandingImage("/api/admin/settings/branding-image/social-share-image");

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
      apiFetch<{ accounts: AdminArtistRateAccount[] }>(
        `/api/admin/finance/rates${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`
      ),
    queryKey: adminFinanceRatesQueryKey(q.trim()),
  });
}

// A pricing entry's micros fields cross the wire as decimal strings (a
// bigint can't ride JSON) — see the ai-pricing route's serializePricing.
export type AdminProviderPricing = {
  inputTokenCostMicrosPerMillion?: string;
  cachedInputTokenCostMicrosPerMillion?: string;
  outputTokenCostMicrosPerMillion?: string;
  inputAudioTokenCostMicrosPerMillion?: string;
  cachedInputAudioTokenCostMicrosPerMillion?: string;
  outputAudioTokenCostMicrosPerMillion?: string;
  characterCostMicros?: string;
  durationSecondCostMicros?: string;
  generationCostMicros?: string;
  longContextThresholdTokens?: string;
  longContext?: AdminProviderPricing;
};

export type AdminProviderRate = {
  provider: string;
  model: string;
  label: string;
  pricing: AdminProviderPricing;
};

export function useAdminAiPricing() {
  return useQuery({
    queryFn: () => apiFetch<{ rates: AdminProviderRate[] }>("/api/admin/finance/ai-pricing"),
    queryKey: adminAiPricingQueryKey,
  });
}

export function useAdminFinancePayouts(q: string) {
  return useQuery({
    queryFn: () =>
      apiFetch<{ accounts: AdminPayoutAccount[] }>(
        `/api/admin/finance/payouts${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`
      ),
    queryKey: adminFinancePayoutsQueryKey(q.trim()),
  });
}

export type AdjustCreatorRateInput =
  | {
      userId: string;
      action: "grant" | "revoke" | "reset-pending" | "reset-available" | "transfer-pending-to-available";
    }
  | { userId: string; action: "set-tier"; tier: "Standard" | "Pro" }
  | {
      userId: string;
      action: "adjust";
      field: "pending" | "available";
      direction: "add" | "deduct";
      amount: number;
    };

export function useAdjustArtistRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustCreatorRateInput) =>
      // revoke returns { ok: true } instead of an account (there isn't one
      // anymore); every other action returns the updated account.
      apiFetch<{ account: AdminArtistRateAccount } | { ok: true }>("/api/admin/finance/rates", {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-rates"] });
      queryClient.invalidateQueries({ queryKey: adminFinanceOverviewQueryKey });
      // grant/set-tier change isArtist/creatorTier on the Users list too.
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
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

export function useAdminCreatorApplications() {
  return useQuery({
    queryFn: () => apiFetch<{ applications: AdminCreatorApplication[] }>("/api/admin/creator-applications"),
    queryKey: adminCreatorApplicationsQueryKey,
  });
}

export function useReviewCreatorApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      status,
      reviewNote,
    }: {
      userId: string;
      status: "Approved" | "Rejected";
      reviewNote?: string;
    }) =>
      apiFetch<{ application: AdminCreatorApplication }>(`/api/admin/creator-applications/${userId}`, {
        body: JSON.stringify({ reviewNote, status }),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCreatorApplicationsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-rates"] });
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

export function useAdminFinanceAffiliates() {
  return useQuery({
    queryFn: () => apiFetch<{ affiliates: AdminAffiliate[] }>("/api/admin/finance/affiliates"),
    queryKey: adminFinanceAffiliatesQueryKey,
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

// Which studios a Pro artist may submit for — the Permissions dialog's
// Studios row. See ProSubmissionCodes.prisma. The picker itself offers only
// studios the signed-in admin owns or manages (useStudios, @/queries/studio)
// — not every studio in the system.
export type AdminArtistStudioAssignment = {
  id: string;
  studio: { id: string; name: string; username: string };
};

export function useArtistStudioAssignments(userId: string | null) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: () =>
      apiFetch<{ assignments: AdminArtistStudioAssignment[] }>(
        `/api/admin/artist-studio-assignments?userId=${encodeURIComponent(userId ?? "")}`,
      ),
    queryKey: adminArtistStudioAssignmentsQueryKey(userId ?? ""),
  });
}

export function useAssignArtistStudio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, studioId }: { userId: string; studioId: string }) =>
      apiFetch<{ assignment: AdminArtistStudioAssignment }>("/api/admin/artist-studio-assignments", {
        body: JSON.stringify({ studioId, userId }),
        method: "POST",
      }),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: adminArtistStudioAssignmentsQueryKey(userId) });
    },
  });
}

export function useUnassignArtistStudio() {
  const queryClient = useQueryClient();
  return useMutation({
    // tierDowngraded: dropping an artist's last studio takes them off Pro
    // too — see the DELETE route.
    mutationFn: ({ userId, studioId }: { userId: string; studioId: string }) =>
      apiFetch<{ ok: boolean; tierDowngraded: boolean }>("/api/admin/artist-studio-assignments", {
        body: JSON.stringify({ studioId, userId }),
        method: "DELETE",
      }),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: adminArtistStudioAssignmentsQueryKey(userId) });
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

// Manually publishes to a connected YouTube destination — see
// /api/admin/social-connections/[id]/publish. videoUrl must already be
// reachable (an R2 object, or any hosted file); there's no upload-from-disk
// path yet, since Vercel's request body limit rules out routing a large
// file straight through this endpoint.
// Shape varies by platform: YouTube/X return a public url, TikTok returns
// only a publishId (self-only posts have no shareable public link).
export type PublishedResult =
  | { videoId: string; url: string }
  | { id: string; url: string }
  | { publishId: string };

export function usePublishSocialVideo() {
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      videoUrl?: string;
      title: string;
      description?: string;
      privacyStatus?: "public" | "unlisted" | "private";
    }) =>
      apiFetch<{ published: PublishedResult }>(`/api/admin/social-connections/${id}/publish`, {
        body: JSON.stringify(body),
        method: "POST",
      }),
  });
}

export type SocialConnectionAnalyticsRow = {
  day: string;
  views: number;
  estimatedMinutesWatched: number;
  likes: number;
  subscribersGained: number;
};

// Fetched on demand (not a background query) since it calls YouTube live —
// see /api/admin/social-connections/[id]/analytics.
export function useSocialConnectionAnalytics() {
  return useMutation({
    mutationFn: ({ id, days }: { id: string; days?: number }) =>
      apiFetch<{ rows: SocialConnectionAnalyticsRow[] }>(
        `/api/admin/social-connections/${id}/analytics${days ? `?days=${days}` : ""}`,
      ),
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

// Adds a reply to a ticket's thread — the server sets status to "Answered"
// itself (unless the ticket is already Closed), so callers only send the
// message.
export function useReplySupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      apiFetch<{ ok: boolean }>(`/api/admin/support-tickets/${id}/messages`, {
        body: JSON.stringify({ message }),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSupportTicketsQueryKey }),
  });
}

export function useUpdateSupportTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminSupportTicket["status"] }) =>
      apiFetch<{ ok: boolean }>(`/api/admin/support-tickets/${id}`, {
        body: JSON.stringify({ status }),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSupportTicketsQueryKey }),
  });
}

export function useUpdateSupportTicketPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: AdminSupportTicket["priority"] }) =>
      apiFetch<{ ok: boolean }>(`/api/admin/support-tickets/${id}`, {
        body: JSON.stringify({ priority }),
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

export type AdminBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMarkdown: string;
  authorName: string | null;
  tags: string[];
  hasCoverImage: boolean;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; displayName: string | null; image: string | null } | null;
};

export function useAdminBlogPosts() {
  return useQuery({
    queryFn: () => apiFetch<{ posts: AdminBlogPost[] }>("/api/admin/blog"),
    queryKey: adminBlogPostsQueryKey,
  });
}

export function useCreateBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      slug: string;
      excerpt?: string;
      contentMarkdown: string;
      authorName?: string;
      tags?: string[];
      published: boolean;
    }) =>
      apiFetch<{ post: AdminBlogPost }>("/api/admin/blog", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminBlogPostsQueryKey }),
  });
}

export function useUpdateBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      slug?: string;
      excerpt?: string | null;
      contentMarkdown?: string;
      authorName?: string | null;
      tags?: string[];
      published?: boolean;
    }) =>
      apiFetch<{ post: AdminBlogPost }>(`/api/admin/blog/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminBlogPostsQueryKey }),
  });
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/api/admin/blog/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminBlogPostsQueryKey }),
  });
}

export function useUploadBlogCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      apiFetch<{ ok: true }>(`/api/admin/blog/${id}/cover`, {
        body: file,
        headers: { "Content-Type": file.type },
        method: "PUT",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminBlogPostsQueryKey }),
  });
}

export type BlogYoutubeImport = {
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl: string | null;
  transcript: string | null;
};

// Read-only: the blog chat agent's import_youtube tool. No query
// invalidation — this doesn't change the post, the agent does that itself
// afterward with the other tools once it has what this returns.
export function useImportBlogYoutube() {
  return useMutation({
    mutationFn: ({ url }: { url: string }) =>
      apiFetch<BlogYoutubeImport>("/api/admin/blog/youtube-import", {
        body: JSON.stringify({ url }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
  });
}

export function useSetBlogCoverFromUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      apiFetch<{ ok: true }>(`/api/admin/blog/${id}/cover`, {
        body: JSON.stringify({ url }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminBlogPostsQueryKey }),
  });
}

export function useRemoveBlogCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/api/admin/blog/${id}/cover`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminBlogPostsQueryKey }),
  });
}

export type BlogContentImageInput =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string }
  | { kind: "base64"; dataBase64: string; contentType: string };

// The Insert Image popover's every source (paste a URL, upload a file, an
// AI-generated result, a media library pick) lands here — see
// api/admin/blog/[id]/images/route.ts for why they all funnel through one
// route. No query invalidation: unlike the cover, nothing in the post row
// tracks these; the returned url is just inserted into the editor's own
// content, which the normal autosave already covers.
export function useAddBlogContentImage() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BlogContentImageInput }) => {
      if (input.kind === "file") {
        return apiFetch<{ id: string; url: string }>(`/api/admin/blog/${id}/images`, {
          body: input.file,
          headers: { "Content-Type": input.file.type },
          method: "POST",
        });
      }
      const body =
        input.kind === "url"
          ? { url: input.url }
          : { contentType: input.contentType, dataBase64: input.dataBase64 };
      return apiFetch<{ id: string; url: string }>(`/api/admin/blog/${id}/images`, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    },
  });
}

// A standalone inference call — no CutProject needed, unlike Cut's own
// image generation (which uploads the result into a project's media
// store). The bytes come back as base64; the caller re-hosts them through
// useAddBlogContentImage to get a durable url.
export function useGenerateBlogImage() {
  return useMutation({
    mutationFn: ({ prompt }: { prompt: string }) =>
      apiFetch<{ outputs: { dataBase64?: string; contentType?: string }[] }>("/api/inference/assets", {
        body: JSON.stringify({ kind: "image", prompt }),
        headers: { "Content-Type": "application/json", "x-depcut-client-id": "depcut-blog" },
        method: "POST",
      }),
  });
}

export type BlogContentVideoInput =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string }
  | { kind: "base64"; dataBase64: string; contentType: string };

// Same shape as useAddBlogContentImage, for api/admin/blog/[id]/videos —
// Upload/Generate/Library all land here; a YouTube link never does (it has
// nothing to store).
export function useAddBlogContentVideo() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BlogContentVideoInput }) => {
      if (input.kind === "file") {
        return apiFetch<{ id: string; url: string }>(`/api/admin/blog/${id}/videos`, {
          body: input.file,
          headers: { "Content-Type": input.file.type },
          method: "POST",
        });
      }
      const body =
        input.kind === "url"
          ? { url: input.url }
          : { contentType: input.contentType, dataBase64: input.dataBase64 };
      return apiFetch<{ id: string; url: string }>(`/api/admin/blog/${id}/videos`, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    },
  });
}

// Same reasoning as useGenerateBlogImage — a standalone inference call, no
// CutProject needed. No provider/model specified: the router falls back to
// whichever configured provider supports kind: "video" (see
// ProviderRegistry.assetProvider), same as image generation already omits
// them.
export function useGenerateBlogVideo() {
  return useMutation({
    mutationFn: ({ prompt }: { prompt: string }) =>
      apiFetch<{ outputs: { dataBase64?: string; contentType?: string }[] }>("/api/inference/assets", {
        body: JSON.stringify({ kind: "video", prompt }),
        headers: { "Content-Type": "application/json", "x-depcut-client-id": "depcut-blog" },
        method: "POST",
      }),
  });
}

export type BlogChatThreadSummary = { id: string; title: string; createdAt: string; updatedAt: string };
export type BlogChatThreadFull = BlogChatThreadSummary & { data: unknown };

// The post editor's chat panel — thread history metadata for the "Past
// threads" flyout. See api/admin/blog/[id]/chats/route.ts.
export function useBlogChatThreads(postId: string | null) {
  return useQuery({
    enabled: Boolean(postId),
    queryFn: () => apiFetch<{ threads: BlogChatThreadSummary[] }>(`/api/admin/blog/${postId}/chats`),
    queryKey: adminBlogChatThreadsQueryKey(postId ?? ""),
  });
}

// One thread's full transcript, fetched lazily when a thread is picked from
// history (the list above only ever hands back metadata).
export async function fetchBlogChatThread(postId: string, chatId: string): Promise<BlogChatThreadFull> {
  const { thread } = await apiFetch<{ thread: BlogChatThreadFull }>(`/api/admin/blog/${postId}/chats/${chatId}`);
  return thread;
}

// Saved once per settled chat turn — id is client-generated (minted when
// "New chat" is clicked), so this is always the row's first write too.
export function useSaveBlogChatThread(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, title, data }: { chatId: string; title?: string; data: unknown }) =>
      apiFetch<{ ok: boolean }>(`/api/admin/blog/${postId}/chats/${chatId}`, {
        body: JSON.stringify({ data, title }),
        method: "PUT",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminBlogChatThreadsQueryKey(postId) });
    },
  });
}

export function useDeleteBlogChatThread(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/blog/${postId}/chats/${chatId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminBlogChatThreadsQueryKey(postId) });
    },
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
