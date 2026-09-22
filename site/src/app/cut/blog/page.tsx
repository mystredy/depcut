import type { Metadata } from "next";
import Link from "next/link";

import { CutFooter } from "@/app/cut/_components/landing/CutFooter";
import { CutTopNav } from "@/app/cut/_components/landing/CutTopNav";
import { Eyebrow, GlassCard } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { BG, TEXT } from "@/app/cut/_components/landing/dark/theme";
import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import { prisma } from "@/lib/prisma";

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

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// The public index at /blog — every published post, newest first. Draft
// posts never reach this query at all (see the admin's own unfiltered list
// at /admin/blog).
export default async function BlogIndexPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: { publishedAt: "desc" },
    where: { published: true },
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        background: BG,
        color: TEXT,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
      }}
    >
      <style>{`html, body { background: ${BG}; overflow-x: hidden; }`}</style>
      <CutTopNav />

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
        {posts.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/50">Nothing posted yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="no-underline">
                <GlassCard fill className="h-full transition-transform hover:-translate-y-0.5">
                  <div className="flex h-full flex-col">
                    {post.hasCoverImage && (
                      // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable static one
                      <img
                        src={`/api/admin/blog/${post.id}/cover`}
                        alt=""
                        className="h-40 w-full object-cover"
                      />
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      <p className="text-[12px] font-medium text-white/40">
                        {post.publishedAt ? formatDate(post.publishedAt) : ""}
                        {post.authorName ? ` · ${post.authorName}` : ""}
                      </p>
                      <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.01em] text-white">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="mt-2.5 line-clamp-3 text-[14px] leading-[1.55] text-white/55">
                          {post.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CutFooter />
    </main>
  );
}
