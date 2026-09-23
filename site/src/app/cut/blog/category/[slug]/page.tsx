import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Eyebrow } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import { categorySlug, collectCategories } from "@/lib/blog/categories";
import { prisma } from "@/lib/prisma";

import { BlogShell } from "../../_components/BlogShell";
import { CategoryChips } from "../../_components/CategoryChips";
import { PostCard } from "../../_components/PostCard";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

// A category has no row of its own — it exists exactly when a published post
// carries a tag that slugifies to it. Fetches every published post rather
// than filtering in the query, since matching is on the derived slug, not a
// stored column; this blog runs at a scale where that's cheap.
async function getCategory(slug: string) {
  const posts = await prisma.blogPost.findMany({
    orderBy: { publishedAt: "desc" },
    where: { published: true },
  });
  const matches = posts.filter((post) => post.tags.some((tag) => categorySlug(tag) === slug));
  if (matches.length === 0) return null;

  const label = matches[0].tags.find((tag) => categorySlug(tag) === slug)!;
  return { allCategories: collectCategories(posts), label, posts: matches };
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};

  const title = `${category.label} — DepCut Blog`;
  const description = `Posts tagged "${category.label}" on the DepCut blog.`;

  return {
    title,
    description,
    alternates: { canonical: `${DEPCUT_CANONICAL}/blog/category/${slug}` },
    openGraph: {
      title,
      description,
      url: `${DEPCUT_CANONICAL}/blog/category/${slug}`,
      siteName: "DepCut",
      type: "website",
    },
  };
}

export default async function BlogCategoryPage({ params }: RouteParams) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  return (
    <BlogShell>
      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-8 md:px-12 md:pt-20">
        <div className="flex flex-col items-center text-center">
          <Eyebrow>Blog</Eyebrow>
          <h1 className="mt-6 text-[clamp(32px,5vw,52px)] font-semibold tracking-[-0.01em] text-white">
            {category.label}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.6] text-white/60">
            {category.posts.length} post{category.posts.length === 1 ? "" : "s"} tagged &ldquo;{category.label}.&rdquo;
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-24 md:px-12">
        <CategoryChips activeSlug={slug} categories={category.allCategories} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {category.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </section>
    </BlogShell>
  );
}
