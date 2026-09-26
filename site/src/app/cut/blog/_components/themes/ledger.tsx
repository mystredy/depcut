import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { formatDate, FullBleedSection, type BlogListPost } from "./shared";

const ACCENT = "#8A6A2F";

export function LedgerList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#F7F5EF">
      <div
        className="flex flex-col gap-8"
        style={{ color: "#14110F", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
      >
        <div
          className="flex items-baseline justify-between pb-4"
          style={{ borderBottom: "2px solid #14110F" }}
        >
          <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 17, fontWeight: 600 }}>
            DepCut Intel
          </span>
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: "#6B6558" }}>
            Product &amp; Craft
          </span>
        </div>
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <div key={post.id} className="flex flex-col gap-3">
              <Link href={`/blog/${post.slug}`} className="flex flex-col gap-3 no-underline">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{
                      fontFamily: "'Source Serif 4', Georgia, serif",
                      fontSize: 28,
                      fontWeight: 600,
                      color: ACCENT,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {post.tags[0] && (
                    <span
                      className="text-[10.5px] font-semibold tracking-[0.1em] uppercase"
                      style={{ color: ACCENT }}
                    >
                      {post.tags[0]}
                    </span>
                  )}
                </div>
                <h2
                  className="text-[19px] leading-snug font-semibold"
                  style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: "#14110F" }}
                >
                  {post.title}
                </h2>
                <p className="text-[12.5px]" style={{ color: "#6B6558" }}>
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
                      className="text-[11px] font-medium no-underline hover:underline"
                      style={{ color: "#8A8578" }}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}
              <div style={{ height: 1, background: "#DDD8CB" }} />
            </div>
          ))}
        </div>
      </div>
    </FullBleedSection>
  );
}
