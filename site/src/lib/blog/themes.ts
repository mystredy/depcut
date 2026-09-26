// The public blog's visual theme — one site-wide setting (see
// lib/blogSettings.ts), applied to the post grid/list on /blog and
// /blog/category/[slug]. "glass" is the original look and stays the
// default; every other id is a distinct layout, not just a recolor —
// see cut/blog/_components/themes/ for what each one actually renders.
export const BLOG_THEMES = [
  {
    id: "glass",
    label: "Glass (default)",
    description: "The original dark glass-card grid.",
  },
  {
    id: "ledger",
    label: "Ledger",
    description: "Finance & business intel — numbered index, serif headlines, paper background.",
  },
  {
    id: "bulletin",
    label: "Bulletin",
    description: "Bold magazine — heavy display type, flat-color covers, punchy category chips.",
  },
  {
    id: "quietPaper",
    label: "Quiet Paper",
    description: "Minimal editorial — text-only list, generous whitespace, elegant serif.",
  },
  {
    id: "nightdesk",
    label: "Nightdesk",
    description: "Refined dark — a tidier evolution of the current look, with an accent color.",
  },
  {
    id: "deck",
    label: "Deck",
    description: "Colorful SaaS grid — rounded white cards, soft shadow, per-category color strip.",
  },
  {
    id: "digest",
    label: "Digest",
    description: "Newsletter list — ranked rows, monogram tiles, no imagery.",
  },
  {
    id: "broadsheet",
    label: "Broadsheet",
    description: "Newspaper front page — one lead story beside a stacked sidebar.",
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "Developer changelog — monospace, command-line prefixes, near-black background.",
  },
  {
    id: "polaroid",
    label: "Polaroid",
    description: "Playful creator style — rotated polaroid cards, handwritten-style tags.",
  },
  {
    id: "brutalist",
    label: "Brutalist",
    description: "Raw Swiss — thick borders, hard offset shadows, no rounded corners.",
  },
  {
    id: "pastelStack",
    label: "Pastel Stack",
    description: "Soft flat-color stacked rows, big rounded corners, friendly and casual.",
  },
  {
    id: "indexCard",
    label: "Index Card",
    description: "Dense table-like list — built for a blog with a lot of posts.",
  },
] as const;

export type BlogThemeId = (typeof BLOG_THEMES)[number]["id"];

export const DEFAULT_BLOG_THEME: BlogThemeId = "glass";

const THEME_IDS = new Set<string>(BLOG_THEMES.map((t) => t.id));

/** A value read back from storage (or a query param, etc.) is untyped —
 * resolve it to a real theme id, falling back to the default rather than
 * letting a stale/bad value 500 the blog. */
export function resolveBlogTheme(id: unknown): BlogThemeId {
  return typeof id === "string" && THEME_IDS.has(id) ? (id as BlogThemeId) : DEFAULT_BLOG_THEME;
}
