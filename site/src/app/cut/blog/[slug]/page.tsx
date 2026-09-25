import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";

import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import { categorySlug } from "@/lib/blog/categories";
import { prisma } from "@/lib/prisma";

import { AuthorAvatar } from "../_components/AuthorAvatar";
import { BlogShell } from "../_components/BlogShell";
import { ShareBar } from "../_components/ShareBar";

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

// Matches exactly the canonical form the editor's "Insert video" button
// writes (insertVideo in PostEditor.tsx) — nothing else. A post's stored
// Markdown never carries a real embed, just an ordinary link (safe to
// store, safe to round-trip); this is what turns that one specific link
// shape into a real, playable embed at render time instead.
const YOUTUBE_WATCH_URL = /^https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,20})$/;

const MARKDOWN_COMPONENTS: Components = {
  a({ href, children, ...props }) {
    const match = href ? YOUTUBE_WATCH_URL.exec(href) : null;
    if (match) {
      const videoId = match[1];
      return (
        <span className="relative my-8 block aspect-video overflow-hidden rounded-2xl bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title="YouTube video"
            className="absolute inset-0 size-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </span>
      );
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
};

export default async function BlogPostPage({ params }: RouteParams) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const authorName = post.authorName?.trim() || "DepCut Team";
  const postUrl = `${DEPCUT_CANONICAL}/blog/${post.slug}`;

  return (
    <BlogShell>
      <article className="mx-auto box-border w-full max-w-5xl px-3 py-12 md:px-10 md:py-20">
        <header className="mb-10">
          <h1 className="text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05] tracking-[-0.01em] text-white">
            {post.title}
          </h1>
          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AuthorAvatar
                name={authorName}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              />
              <div className="text-[13px] leading-tight">
                <p className="font-medium text-white/70">
                  by <span className="font-semibold text-white">{authorName}</span>
                </p>
                <p className="mt-0.5 text-white/40">
                  Published: {post.publishedAt ? formatDate(post.publishedAt) : "—"}
                </p>
              </div>
            </div>
            <ShareBar url={postUrl} title={post.title} variant="icon" />
          </div>
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
          <ReactMarkdown components={MARKDOWN_COMPONENTS}>{post.contentMarkdown}</ReactMarkdown>
        </div>

        <footer className="mt-12 space-y-6 border-t border-white/10 pt-8">
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
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
          <ShareBar url={postUrl} title={post.title} />
        </footer>
      </article>
    </BlogShell>
  );
}
