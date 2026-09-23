// A BlogPost category is just one of its tags, addressed by a derived slug —
// there's no Category row. /blog/category/[slug] filters published posts
// whose tags match, so a category "exists" exactly when a published post
// carries it.
export function categorySlug(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Trims, drops empties, and case-insensitively dedupes — used wherever a post's
// tag list is written (admin create/update) so storage never depends on the
// caller having already cleaned the array.
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of tags) {
    const label = raw.trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    clean.push(label);
  }
  return clean;
}

export type BlogCategory = { slug: string; label: string; count: number };

// The distinct categories across a set of posts, most-used first — each
// post's own tags are already unique (normalizeTags), but two differently-
// cased tags across posts ("Guides" / "guides") collapse to one category
// here, keeping the first-seen casing as the display label.
export function collectCategories(posts: { tags: string[] }[]): BlogCategory[] {
  const bySlug = new Map<string, BlogCategory>();
  for (const post of posts) {
    for (const tag of post.tags) {
      const slug = categorySlug(tag);
      if (!slug) continue;
      const existing = bySlug.get(slug);
      if (existing) existing.count += 1;
      else bySlug.set(slug, { count: 1, label: tag, slug });
    }
  }
  return [...bySlug.values()].sort((a, b) => b.count - a.count);
}
