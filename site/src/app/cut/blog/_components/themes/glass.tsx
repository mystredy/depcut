import Link from "next/link";

import { GlassCard } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { categorySlug } from "@/lib/blog/categories";

import { coverUrl, formatDate, type BlogListPost } from "./shared";

// The original theme, unchanged — this is what every post grid looked like
// before themes existed, kept as the default rather than recreated to match
// a mockup.
function GlassCardItem({ post }: { post: BlogListPost }) {
  const cover = coverUrl(post);
  return (
    <GlassCard fill className="h-full transition-transform hover:-translate-y-0.5">
      <div className="flex h-full flex-col">
        <Link href={`/blog/${post.slug}`} className="flex flex-1 flex-col no-underline">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable one
            <img src={cover} alt="" className="h-40 w-full object-cover" />
          )}
          <div className="flex flex-1 flex-col p-6 pb-0">
            <p className="text-[12px] font-medium text-white/40">
              {post.publishedAt ? formatDate(post.publishedAt) : ""}
              {post.authorName ? ` · ${post.authorName}` : ""}
            </p>
            <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.01em] text-white">{post.title}</h2>
            {post.excerpt && (
              <p className="mt-2.5 line-clamp-3 text-[14px] leading-[1.55] text-white/55">{post.excerpt}</p>
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

export function GlassList({ posts }: { posts: BlogListPost[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {posts.map((post) => (
        <GlassCardItem key={post.id} post={post} />
      ))}
    </div>
  );
}
