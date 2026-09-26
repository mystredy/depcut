import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { coverUrl, formatDate, type BlogListPost } from "./shared";

const ACCENT = "#7C8CFF";

// Dark, like the page chrome already is — no full-bleed background needed,
// this just sits on BlogShell's own dark background with nicer typography
// and an accent color instead of plain white-on-black.
export function NightdeskList({ posts }: { posts: BlogListPost[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => {
        const cover = coverUrl(post);
        return (
          <div
            key={post.id}
            className="flex flex-col gap-3.5 rounded-xl p-4.5 transition-transform hover:-translate-y-0.5"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Link href={`/blog/${post.slug}`} className="flex flex-col gap-3.5 no-underline">
              <div
                className="flex h-[108px] items-center justify-center overflow-hidden rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable one
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.6">
                    <path d="M4 12h4l3-8 4 16 3-8h2"></path>
                  </svg>
                )}
              </div>
              <div>
                {post.tags[0] && (
                  <span className="text-[10.5px] font-semibold tracking-[0.08em] uppercase" style={{ color: ACCENT }}>
                    {post.tags[0]}
                  </span>
                )}
                <h2
                  className="mt-2 text-[16.5px] leading-[1.35] font-semibold"
                  style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", color: "#F2F1EC" }}
                >
                  {post.title}
                </h2>
              </div>
              <p className="text-[11.5px]" style={{ color: "#8B8A83" }}>
                {post.publishedAt ? formatDate(post.publishedAt) : ""}
                {post.authorName ? ` · ${post.authorName}` : ""}
              </p>
            </Link>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog/category/${categorySlug(tag)}`}
                    className="text-[11px] no-underline hover:underline"
                    style={{ color: "#8B8A83" }}
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
