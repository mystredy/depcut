import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { formatDate, FullBleedSection, type BlogListPost } from "./shared";

export function QuietPaperList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#F6F2E9">
      <div className="flex flex-col gap-10" style={{ color: "#241F19" }}>
        <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontStyle: "italic", color: "#8A8270" }}>
          DepCut Journal
        </span>
        <div className="flex flex-col">
          {posts.map((post, i) => (
            <div
              key={post.id}
              className="flex flex-col gap-2 py-6"
              style={{
                borderTop: "1px solid #DED6C2",
                borderBottom: i === posts.length - 1 ? "1px solid #DED6C2" : undefined,
              }}
            >
              <Link
                href={`/blog/${post.slug}`}
                className="flex flex-col items-start justify-between gap-1 no-underline sm:flex-row sm:items-baseline sm:gap-10"
              >
                <h2
                  className="text-[22px] leading-[1.3] font-medium sm:text-[25px]"
                  style={{ fontFamily: "'Fraunces', Georgia, serif", color: "#241F19" }}
                >
                  {post.title}
                </h2>
                <span className="shrink-0 text-[12.5px]" style={{ color: "#8A8270" }}>
                  {post.publishedAt ? formatDate(post.publishedAt) : ""}
                </span>
              </Link>
              {post.excerpt && (
                <p className="max-w-2xl text-[13.5px] leading-[1.6]" style={{ color: "#5C5548" }}>
                  {post.excerpt}
                </p>
              )}
              {post.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog/category/${categorySlug(tag)}`}
                      className="text-[11.5px] no-underline hover:underline"
                      style={{ color: "#B5613B" }}
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </FullBleedSection>
  );
}
