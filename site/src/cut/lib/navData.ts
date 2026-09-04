import {
  Clapperboard,
  Compass,
  FolderKanban,
  FolderOpen,
  Image,
  LayoutDashboard,
  Languages,
  MessageSquare,
  Scissors,
  Sparkles,
  Video,
  Volume2,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { CUT_APP_BASE, homeHref, type CutTab } from "@/cut/lib/nav";

export const LINKS: { tab: CutTab; label: string; icon: LucideIcon }[] = [
  { tab: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { tab: "library", label: "Library", icon: FolderOpen },
];

// A child's location is normally its group's own route (${base}/${group.key}/${slug}).
// href overrides that for links that point elsewhere, like "Editor > Video"
// below, which reuses the existing Projects page instead of owning a route.
export type NavChild = { slug: string; label: string; icon: LucideIcon; href?: string };
export type NavGroup = { key: string; label: string; icon: LucideIcon; children: NavChild[] };

export const GROUPS: NavGroup[] = [
  {
    key: "ai-suite",
    label: "AI suite",
    icon: Sparkles,
    children: [
      { slug: "scripting", label: "Scripting", icon: Sparkles },
      { slug: "speech-to-text", label: "Speech to Text", icon: MessageSquare },
      { slug: "text-to-speech", label: "Text to Speech", icon: Volume2 },
      { slug: "dubbing", label: "Dubbing", icon: Languages },
      { slug: "image-video", label: "Flow", icon: Clapperboard },
      // Superseded by Flow above (unified Flow threads) — kept reachable
      // until that page is fully verified, then redirected here.
      { slug: "text-to-image", label: "Text to Image", icon: Image },
      { slug: "text-to-video", label: "Text to Video", icon: Video },
      { slug: "ai-chatbot", label: "AI Chatbot", icon: MessageSquare },
    ],
  },
  {
    key: "editor",
    label: "Editor",
    icon: Scissors,
    children: [
      { slug: "motion", label: "Motion", icon: Wand2 },
      { slug: "video", label: "Video", icon: Video, href: `${CUT_APP_BASE}/projects` },
      { slug: "photo", label: "Photo", icon: Image },
    ],
  },
];

export const CREATOR_HUB_GROUP: NavGroup = {
  key: "creator-hub",
  label: "Creator Hub",
  icon: Video,
  children: [
    { slug: "inspiration", label: "Inspiration", icon: Compass },
    { slug: "my-projects", label: "My Submissions", icon: FolderKanban },
  ],
};

export const ALL_GROUPS = [...GROUPS, CREATOR_HUB_GROUP];

/** The current page's label, for the header's page-title pill. */
export function pageTitleForPath(pathname: string, base: string): string {
  // The Projects page's nav entry was "My Projects" (its Creator Hub link)
  // label; we've renamed the link to "My Submissions" but the page itself
  // is still titled "Projects".
  if (pathname === `${base}/projects`) return "Projects";
  const link = LINKS.find((l) => pathname === homeHref(base, l.tab));
  if (link) return link.label;
  for (const group of ALL_GROUPS) {
    const child = group.children.find(
      (c) => pathname === (c.href ?? `${base}/${group.key}/${c.slug}`)
    );
    if (child) return child.label;
  }
  return "Depcut";
}
