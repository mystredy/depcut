import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { formatDate, FullBleedSection, type BlogListPost } from "./shared";

const BANDS = [
  { bg: "#DCEBFF", label: "#3B6EF6", date: "#5A6B8C" },
  { bg: "#FFE3EC", label: "#C23E62", date: "#8C5A6E" },
  { bg: "#DFF5E3", label: "#1E9E6D", date: "#4A8C6E" },
];

export function PastelStackList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#FFFFFF">
      <div className="flex flex-col gap-5" style={{ color: "#2A2A2A" }}>
        <span style={{ fontFamily: "'Quicksand', system-ui, sans-serif", fontSize: 19, fontWeight: 700 }}>
          What&apos;s new
        </span>
        {posts.map((post, i) => {
          const band = BANDS[i % BANDS.length];
          return (
            <div
              key={post.id}
              className="flex flex-col gap-2 rounded-3xl px-6 py-5 transition-transform hover:translate-x-1 sm:flex-row sm:items-center sm:gap-6"
              style={{ background: band.bg }}
            >
              <Link href={`/blog/${post.slug}`} className="min-w-0 flex-1 no-underline">
                {post.tags[0] && (
                  <span
                    className="text-[11px] font-semibold tracking-[0.04em] uppercase"
                    style={{ color: band.label }}
                  >
                    {post.tags[0]}
                  </span>
                )}
                <h2
                  className="mt-1.5 text-[20px] leading-[1.3] font-bold"
                  style={{ fontFamily: "'Quicksand', system-ui, sans-serif" }}
                >
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5]" style={{ color: "#4A4A4A" }}>
                    {post.excerpt}
                  </p>
                )}
              </Link>
              <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                <span className="text-[12px]" style={{ color: band.date }}>
                  {post.publishedAt ? formatDate(post.publishedAt) : ""}
                </span>
                {post.tags.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.slice(1).map((tag) => (
                      <Link
                        key={tag}
                        href={`/blog/category/${categorySlug(tag)}`}
                        className="text-[11px] no-underline hover:underline"
                        style={{ color: band.date }}
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </FullBleedSection>
  );
}
