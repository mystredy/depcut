import type { ReactNode } from "react";

// The exact post shape every theme renders from — matches what /blog and
// /blog/category/[slug] select off BlogPost (see their prisma.blogPost calls).
export type BlogListPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  hasCoverImage: boolean;
  publishedAt: Date | null;
  authorName: string | null;
  tags: string[];
};

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** A post's real cover, when it has one — themes fall back to their own
 * placeholder when it doesn't, they never fabricate a photo. */
export function coverUrl(post: BlogListPost): string | null {
  return post.hasCoverImage ? `/api/admin/blog/${post.id}/cover` : null;
}

/** Breaks a themed section out of the page's centered max-w-5xl column back
 * to the full viewport width, so a light theme's background paints edge to
 * edge instead of leaving the dark page chrome showing in the gutters.
 * BlogShell's dark themes (glass, nightdesk, terminal) don't need this —
 * they already match the page's own background. */
export function FullBleedSection({
  background,
  children,
}: {
  background: string;
  children: ReactNode;
}) {
  return (
    <div style={{ background, width: "100vw", marginLeft: "calc(50% - 50vw)" }}>
      <div className="mx-auto w-full max-w-5xl px-6 py-14 md:px-12 md:py-20">{children}</div>
    </div>
  );
}
