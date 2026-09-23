import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import { categorySlug } from "@/lib/blog/categories";
import { prisma } from "@/lib/prisma";

import { BlogShell } from "../_components/BlogShell";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

async function getPost(slug: string) {
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  // A draft 404s in public even for a signed-in admin — the admin editor's
  // own "View" link only ever appears once a post is published.
  if (!post?.published) return null;
  return post;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  const description = post.excerpt ?? undefined;
  const coverUrl = post.hasCoverImage ? `${DEPCUT_CANONICAL}/api/admin/blog/${post.id}/cover` : undefined;

  return {
    title: `${post.title} — DepCut Blog`,
    description,
    alternates: { canonical: `${DEPCUT_CANONICAL}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description,
      url: `${DEPCUT_CANONICAL}/blog/${post.slug}`,
      siteName: "DepCut",
      type: "article",
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
    twitter: {
      card: coverUrl ? "summary_large_image" : "summary",
      title: post.title,
      description,
      images: coverUrl ? [coverUrl] : undefined,
    },
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function BlogPostPage({ params }: RouteParams) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <BlogShell>
      <article className="mx-auto box-border w-full max-w-3xl px-6 py-12 md:px-10 md:py-20">
        <header className="mb-10">
          <h1 className="text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05] tracking-[-0.01em] text-white">
            {post.title}
          </h1>
          <p className="mt-4 text-[13px] font-medium text-white/40">
            {post.publishedAt ? formatDate(post.publishedAt) : ""}
            {post.authorName ? ` · ${post.authorName}` : ""}
          </p>
          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog/category/${categorySlug(tag)}`}
                  className="rounded-full border border-white/15 px-2.5 py-1 text-[12px] font-medium text-white/55 no-underline transition-colors hover:border-white/30 hover:text-white"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </header>

        {post.hasCoverImage && (
          // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable static one
          <img
            src={`/api/admin/blog/${post.id}/cover`}
            alt=""
            className="mb-10 w-full rounded-2xl object-cover"
          />
        )}

        <div className="prose prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-normal prose-h2:mt-10 prose-h2:border-t prose-h2:border-white/15 prose-h2:pt-8 prose-a:font-semibold prose-a:text-white prose-strong:text-white prose-p:text-white/70 prose-li:text-white/70">
          <ReactMarkdown>{post.contentMarkdown}</ReactMarkdown>
        </div>
      </article>
    </BlogShell>
  );
}
