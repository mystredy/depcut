"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AudioLines,
  Bot,
  ChevronDown,
  Clapperboard,
  Coins,
  CreditCard,
  DollarSign,
  FileCheck2,
  FileText,
  Folder,
  FolderOpen,
  Gift,
  HelpCircle,
  Image as ImageIcon,
  Key,
  LayoutDashboard,
  Layers,
  LineChart,
  Link2,
  Megaphone,
  MessageSquare,
  RotateCw,
  Send,
  Settings as SettingsIcon,
  Share2,
  ShieldAlert,
  Sparkles,
  Terminal,
  Users2,
  Video,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type LeafItem = { label: string; href: string; icon: LucideIcon; color: string };
type NavSection =
  | { kind: "leaf"; id: string; label: string; icon: LucideIcon; color: string; href: string }
  | { kind: "group"; id: string; label: string; icon: LucideIcon; color: string; children: LeafItem[] };

// A route this build doesn't have yet lands on a shared honest placeholder
// instead of a dead link — see /admin/more.
const soon = (topic: string) => `/admin/more?topic=${encodeURIComponent(topic)}`;

const SECTIONS: NavSection[] = [
  { kind: "leaf", id: "dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-blue-500", href: "/admin" },
  {
    kind: "group",
    id: "submissions",
    label: "Submissions",
    icon: FileCheck2,
    color: "text-sky-500",
    children: [
      { label: "Project Submission", href: "/admin/project-submissions", icon: Clapperboard, color: "text-violet-500" },
      { label: "Creator Submissions", href: "/admin/submissions", icon: FileCheck2, color: "text-emerald-500" },
      { label: "Publisher Posts", href: "/admin/uploads", icon: Send, color: "text-pink-500" },
    ],
  },
  {
    kind: "group",
    id: "task-management",
    label: "Task Management",
    icon: Layers,
    color: "text-purple-500",
    children: [
      { label: "Campaigns List", href: "/admin/task-management/campaigns", icon: Layers, color: "text-purple-500" },
      { label: "Create Campaign", href: "/admin/task-management/create", icon: Megaphone, color: "text-sky-500" },
    ],
  },
  {
    kind: "group",
    id: "user-management",
    label: "User Management",
    icon: Users2,
    color: "text-indigo-500",
    children: [
      { label: "Users List", href: "/admin/users", icon: Users2, color: "text-violet-500" },
      { label: "Users Activities", href: soon("User Management — Users Activities"), icon: Activity, color: "text-emerald-500" },
      { label: "Users Dashboard", href: soon("User Management — Users Dashboard"), icon: LayoutDashboard, color: "text-amber-500" },
      { label: "User Deletion Requests", href: soon("User Management — Deletion Requests"), icon: ShieldAlert, color: "text-red-500" },
      { label: "User Permissions", href: "/admin/users", icon: ShieldAlert, color: "text-pink-600" },
    ],
  },
  {
    kind: "group",
    id: "content",
    label: "Content",
    icon: FolderOpen,
    color: "text-fuchsia-500",
    children: [
      { label: "Projects", href: "/admin/content/projects", icon: Clapperboard, color: "text-violet-500" },
      { label: "Images", href: "/admin/content/images", icon: ImageIcon, color: "text-amber-500" },
      { label: "Videos", href: "/admin/content/videos", icon: Video, color: "text-rose-500" },
      { label: "Audio", href: "/admin/content/audio", icon: AudioLines, color: "text-sky-500" },
    ],
  },
  {
    kind: "group",
    id: "social-media",
    label: "Social Media",
    icon: Share2,
    color: "text-pink-500",
    children: [
      { label: "Connections", href: "/admin/social/connections", icon: Link2, color: "text-violet-500" },
      { label: "Posts", href: soon("Social Media — Posts"), icon: FileText, color: "text-orange-500" },
      { label: "Brand Suite", href: "/admin/social/brands", icon: Share2, color: "text-pink-500" },
      { label: "Workflow", href: "/admin/social/workflows", icon: Workflow, color: "text-sky-500" },
      { label: "Analysis", href: soon("Social Media — Analysis"), icon: LineChart, color: "text-emerald-500" },
    ],
  },
  {
    kind: "group",
    id: "telegram-bot",
    label: "Telegram Bot",
    icon: Send,
    color: "text-sky-500",
    children: [
      { label: "Overview", href: "/admin/telegram-bot", icon: LayoutDashboard, color: "text-sky-500" },
      { label: "My Bot", href: "/admin/telegram-bot/my-bot", icon: Bot, color: "text-sky-500" },
      { label: "Commands", href: "/admin/telegram-bot/commands", icon: Terminal, color: "text-sky-500" },
      { label: "Settings", href: "/admin/telegram-bot/settings", icon: SettingsIcon, color: "text-sky-500" },
    ],
  },
  { kind: "leaf", id: "announcements", label: "Announcements", icon: Megaphone, color: "text-amber-500", href: "/admin/announcements" },
  { kind: "leaf", id: "support-requests", label: "Support Requests", icon: HelpCircle, color: "text-red-500", href: "/admin/support" },
  {
    kind: "group",
    id: "chat-settings",
    label: "Chat Settings",
    icon: MessageSquare,
    color: "text-blue-500",
    children: [
      { label: "Chat Settings", href: "/admin/chat/settings", icon: MessageSquare, color: "text-blue-500" },
      { label: "Chat Categories", href: "/admin/chat/categories", icon: Folder, color: "text-sky-500" },
      { label: "Chat Templates", href: "/admin/chat/templates", icon: FileText, color: "text-cyan-500" },
      { label: "AI Engines", href: "/admin/chat/engines", icon: RotateCw, color: "text-emerald-500" },
    ],
  },
  {
    kind: "group",
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    color: "text-emerald-500",
    children: [
      { label: "Dashboard", href: "/admin/finance", icon: LayoutDashboard, color: "text-emerald-500" },
      { label: "Creator Applications", href: "/admin/finance/creator-applications", icon: Clapperboard, color: "text-fuchsia-500" },
      { label: "Withdrawals", href: "/admin/finance/withdrawals", icon: DollarSign, color: "text-rose-500" },
      { label: "Rates", href: "/admin/finance/rates", icon: Coins, color: "text-amber-500" },
      { label: "Transactions", href: "/admin/finance/transactions", icon: Activity, color: "text-blue-500" },
      { label: "Payout Queue", href: "/admin/finance/payout-queue", icon: Layers, color: "text-indigo-500" },
      { label: "Giveaways", href: "/admin/finance/giveaways", icon: Gift, color: "text-pink-500" },
      { label: "Referrals", href: "/admin/finance/referrals", icon: Users2, color: "text-violet-500" },
      { label: "Payment Methods", href: "/admin/finance/payment-methods", icon: CreditCard, color: "text-cyan-500" },
      { label: "AI Credits", href: "/admin/users", icon: Zap, color: "text-yellow-500" },
      { label: "Reports", href: "/admin/finance/reports", icon: FileText, color: "text-orange-500" },
      { label: "Finance Settings", href: "/admin/finance/settings", icon: SettingsIcon, color: "text-gray-500" },
      { label: "Payment API", href: "/admin/finance/payment-api", icon: Key, color: "text-amber-500" },
    ],
  },
  {
    kind: "group",
    id: "pages",
    label: "Pages",
    icon: FileText,
    color: "text-zinc-500",
    children: [
      { label: "Legal Pages", href: "/admin/pages", icon: FileText, color: "text-zinc-500" },
      { label: "Onboarding", href: "/admin/onboarding", icon: Sparkles, color: "text-teal-500" },
    ],
  },
  { kind: "leaf", id: "affiliates", label: "Affiliates", icon: Link2, color: "text-yellow-500", href: soon("Affiliates") },
  {
    kind: "group",
    id: "api-integration",
    label: "API Integration",
    icon: Key,
    color: "text-violet-500",
    children: [
      { label: "OpenAI", slug: "openai" },
      { label: "Gemini", slug: "gemini" },
      { label: "Anthropic", slug: "anthropic" },
      { label: "Fal AI", slug: "fal_ai" },
      { label: "Open Router", slug: "open_router" },
      { label: "ElevenLabs", slug: "elevenlabs" },
    ].map(({ label, slug }) => ({
      label,
      href: `/admin/api-integration/${slug}`,
      icon: Key,
      color: "text-violet-500",
    })),
  },
  {
    kind: "group",
    id: "settings",
    label: "Settings",
    icon: SettingsIcon,
    color: "text-gray-500",
    children: [
      { label: "General Settings", href: "/admin/settings/general", icon: SettingsIcon, color: "text-gray-400" },
      { label: "Maintenance", href: "/admin/settings/maintenance", icon: SettingsIcon, color: "text-gray-400" },
      { label: "AI Models", href: "/admin/settings/ai-models", icon: SettingsIcon, color: "text-gray-400" },
      { label: "OAuth App", href: "/admin/settings/oauth-app", icon: SettingsIcon, color: "text-gray-400" },
      { label: "Categories & Niches", href: "/admin/settings/categories", icon: SettingsIcon, color: "text-primary" },
    ],
  },
];

/** The current route's own nav entry — its icon, label, and accent color —
 * for the header bar's `[toggle][icon][title]` strip above every page, so
 * that strip never needs a page to declare its own heading twice. Only
 * matches a route SECTIONS actually names (a "coming soon" placeholder's
 * query string means it never matches, so it falls back to no icon). */
export function findAdminNavItem(pathname: string): LeafItem | null {
  for (const section of SECTIONS) {
    if (section.kind === "leaf" && section.href === pathname) {
      return { color: section.color, href: section.href, icon: section.icon, label: section.label };
    }
    if (section.kind === "group") {
      const child = section.children.find((c) => c.href === pathname);
      if (child) return child;
    }
  }
  return null;
}

export function AdminNav() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="px-4 py-4">
        <p className="text-sm font-semibold">DepCut Admin</p>
        <p className="text-xs text-muted-foreground">Site management</p>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;

          if (section.kind === "leaf") {
            const active = pathname === section.href;
            return (
              <Link
                key={section.id}
                href={section.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-primary/10 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4 shrink-0", section.color)} />
                <span className="truncate">{section.label}</span>
              </Link>
            );
          }

          const isOpen = expanded[section.id] ?? false;
          const isAnyChildActive = section.children.some(
            (c) => !c.href.startsWith("/admin/more") && pathname === c.href
          );

          return (
            <div key={section.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  isAnyChildActive
                    ? "bg-primary/10 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className={cn("size-4 shrink-0", section.color)} />
                  <span className="truncate">{section.label}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div className="mt-0.5 ml-3.5 space-y-0.5 border-l pl-3">
                  {section.children.map((child) => {
                    const ChildIcon = child.icon;
                    const active = !child.href.startsWith("/admin/more") && pathname === child.href;
                    return (
                      <Link
                        key={child.label}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "bg-muted font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        <ChildIcon className={cn("size-3.5 shrink-0", active ? child.color : "text-muted-foreground")} />
                        <span className="truncate">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t px-4 py-3">
        <Link href="/app" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          ← Back to DepCut
        </Link>
      </div>
    </nav>
  );
}
