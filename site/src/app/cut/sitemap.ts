import type { MetadataRoute } from "next";

import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import { prisma } from "@/lib/prisma";

// Served at depcut.app/sitemap.xml via the proxy rewrite (src/proxy.ts).
// The legal pages are canonical on this host, since they describe DepCut.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await prisma.blogPost.findMany({
    orderBy: { publishedAt: "desc" },
    select: { slug: true, updatedAt: true },
    where: { published: true },
  });

  return [
    {
      url: `${DEPCUT_CANONICAL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${DEPCUT_CANONICAL}/depcutvision`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${DEPCUT_CANONICAL}/blog`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    ...posts.map((post) => ({
      url: `${DEPCUT_CANONICAL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    {
      url: `${DEPCUT_CANONICAL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${DEPCUT_CANONICAL}/terms`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
