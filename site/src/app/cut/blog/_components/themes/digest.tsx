import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { THEME_FONTS } from "./fonts";
import { formatDate, FullBleedSection, type BlogListPost } from "./shared";

const HEADLINE = THEME_FONTS.digest.headline;

const TILES = ["#C9542C", "#1B1812", "#6B6558", "#2E6B5E", "#3C5AA6"];

function tileLabel(tags: string[]): string {
  return (tags[0] ?? "post").slice(0, 3).toUpperCase();
}

export function DigestList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#FAF8F3">
      <div className="flex flex-col gap-2" style={{ color: "#1B1812" }}>
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-[19px] font-extrabold" style={{ fontFamily: HEADLINE }}>
            The DepCut Digest
          </span>
          <span className="text-[11.5px]" style={{ color: "#8A8578" }}>
            {posts.length} post{posts.length === 1 ? "" : "s"}
          </span>
        </div>
        {posts.map((post, i) => (
          <div
            key={post.id}
            className="flex flex-col gap-2 py-5 sm:flex-row sm:items-start sm:gap-5"
            style={{ borderTop: "1px solid #E8E3D6" }}
          >
            <div className="flex items-start gap-5">
              <span
                className="w-[34px] shrink-0 text-[22px] font-bold"
                style={{ fontFamily: HEADLINE, color: "#D8D2C1" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className="grid size-11 shrink-0 place-items-center rounded-lg text-[10px] font-bold tracking-[0.04em] text-white"
                style={{ background: TILES[i % TILES.length] }}
              >
                {tileLabel(post.tags)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/blog/${post.slug}`} className="no-underline">
                <h2
                  className="text-[17px] leading-[1.3] font-bold"
                  style={{ fontFamily: HEADLINE, color: "#1B1812" }}
                >
                  {post.title}
                </h2>
              </Link>
              {post.excerpt && (
                <p className="mt-1 text-[12.5px] leading-[1.5]" style={{ color: "#6B6558" }}>
                  {post.excerpt}
                </p>
              )}
              {post.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog/category/${categorySlug(tag)}`}
                      className="text-[11px] no-underline hover:underline"
                      style={{ color: "#8A8578" }}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <span className="shrink-0 text-[11.5px]" style={{ color: "#8A8578" }}>
              {post.publishedAt ? formatDate(post.publishedAt) : ""}
            </span>
          </div>
        ))}
      </div>
    </FullBleedSection>
  );
}
