import Link from "next/link";

import { GlassCard } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { categorySlug } from "@/lib/blog/categories";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  hasCoverImage: boolean;
  publishedAt: Date | null;
  authorName: string | null;
  tags: string[];
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// The card on /blog and /blog/category/[slug]. The post link and the tag
// links are siblings, not nested — a tag inside the post <Link> would be an
// <a> inside an <a>, which is invalid HTML and breaks hydration.
export function PostCard({ post }: { post: Post }) {
  return (
    <GlassCard fill className="h-full transition-transform hover:-translate-y-0.5">
      <div className="flex h-full flex-col">
        <Link href={`/blog/${post.slug}`} className="flex flex-1 flex-col no-underline">
          {post.hasCoverImage && (
            // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable static one
            <img
              src={`/api/admin/blog/${post.id}/cover`}
              alt=""
              className="h-40 w-full object-cover"
            />
          )}
          <div className="flex flex-1 flex-col p-6 pb-0">
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
        </Link>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-6 pt-3">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog/category/${categorySlug(tag)}`}
                className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-medium text-white/50 no-underline transition-colors hover:border-white/30 hover:text-white"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
