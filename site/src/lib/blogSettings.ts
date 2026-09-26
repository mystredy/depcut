import { unstable_cache } from "next/cache";
import { cache } from "react";

import { DEFAULT_BLOG_THEME, resolveBlogTheme, type BlogThemeId } from "@/lib/blog/themes";
import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

/** The raw read, no memoization — same shape as siteSettings.ts's
 * fetchPublicSiteSettings: a missing row (nobody has picked a theme yet)
 * reads as the default without writing anything, and any DB hiccup falls
 * back to the default rather than taking the whole public blog down. */
async function fetchBlogTheme(): Promise<BlogThemeId> {
  try {
    const row = await prisma.blogSettings.findUnique({
      select: { theme: true },
      where: { id: SINGLETON_ID },
    });
    return resolveBlogTheme(row?.theme ?? DEFAULT_BLOG_THEME);
  } catch {
    return DEFAULT_BLOG_THEME;
  }
}

/** Read from /blog and /blog/category/[slug] (server components) — cached a
 * minute, same as publicSiteSettings, so picking a new theme in admin lands
 * within a minute rather than needing a redeploy, without a DB round trip on
 * every single blog page view. */
export const blogTheme = cache(unstable_cache(fetchBlogTheme, ["public-blog-theme"], { revalidate: 60 }));

export { fetchBlogTheme };
