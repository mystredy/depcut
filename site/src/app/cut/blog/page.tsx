import type { Metadata } from "next";

import { Eyebrow } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import { collectCategories } from "@/lib/blog/categories";
import { blogTheme } from "@/lib/blogSettings";
import { prisma } from "@/lib/prisma";

import { BlogShell } from "./_components/BlogShell";
import { CategoryChips } from "./_components/CategoryChips";
import { BlogPostList } from "./_components/themes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog — DepCut",
  description: "Product updates, guides, and news from the DepCut team.",
  alternates: { canonical: `${DEPCUT_CANONICAL}/blog` },
  openGraph: {
    title: "Blog — DepCut",
    description: "Product updates, guides, and news from the DepCut team.",
    url: `${DEPCUT_CANONICAL}/blog`,
    siteName: "DepCut",
    type: "website",
  },
};

// The public index at /blog — every published post, newest first. Draft
// posts never reach this query at all (see the admin's own unfiltered list
// at /admin/blog).
export default async function BlogIndexPage() {
  const [posts, theme] = await Promise.all([
    prisma.blogPost.findMany({
      orderBy: { publishedAt: "desc" },
      where: { published: true },
    }),
    blogTheme(),
  ]);
  const categories = collectCategories(posts);

  return (
    <BlogShell>
      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-8 md:px-12 md:pt-20">
        <div className="flex flex-col items-center text-center">
          <Eyebrow>Blog</Eyebrow>
          <h1 className="mt-6 text-[clamp(32px,5vw,52px)] font-semibold tracking-[-0.01em] text-white">
            Product updates &amp; news
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.6] text-white/60">
            What&apos;s new in DepCut, how to get the most out of it, and what we&apos;re
            building next.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-24 md:px-12">
        <CategoryChips categories={categories} />
        {posts.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/50">Nothing posted yet — check back soon.</p>
        ) : (
          <BlogPostList theme={theme} posts={posts} />
        )}
      </section>
    </BlogShell>
  );
}
