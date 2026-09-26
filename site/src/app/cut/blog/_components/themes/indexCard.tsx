import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { formatDate, FullBleedSection, type BlogListPost } from "./shared";

const SWATCHES = ["#8A6A2F", "#3B6EF6", "#1E9E6D", "#7B5CFA", "#C9542C"];

export function IndexCardList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#FFFFFF">
      <div className="flex flex-col" style={{ color: "#16130F" }}>
        <div className="mb-4.5 flex items-baseline justify-between">
          <span className="text-[17px] font-semibold">All posts</span>
          <span className="text-[11.5px]" style={{ color: "#8A8578" }}>
            {posts.length} total
          </span>
        </div>
        <div
          className="hidden gap-0 px-3.5 py-2 text-[10.5px] font-semibold tracking-[0.06em] uppercase sm:flex"
          style={{ color: "#8A8578", borderBottom: "1px solid #E5E1D6" }}
        >
          <span className="w-3.5 shrink-0" />
          <span className="flex-1 pl-3.5">Title</span>
          <span className="w-[110px] shrink-0">Category</span>
          <span className="w-20 shrink-0 text-right">Date</span>
        </div>
        {posts.map((post, i) => (
          <div key={post.id} className="flex flex-col gap-1.5 py-3.5" style={{ borderBottom: "1px solid #F0EDE3" }}>
            <Link
              href={`/blog/${post.slug}`}
              className="flex flex-col gap-1 no-underline sm:flex-row sm:items-center sm:gap-0"
            >
              <span
                className="hidden size-3.5 shrink-0 rounded sm:block"
                style={{ background: SWATCHES[i % SWATCHES.length] }}
              />
              <span className="flex-1 text-[14px] font-medium sm:pl-3.5">{post.title}</span>
              <span className="w-[110px] shrink-0 text-[12px]" style={{ color: "#6B6558" }}>
                {post.tags[0] ?? ""}
              </span>
              <span className="w-20 shrink-0 text-[12px] sm:text-right" style={{ color: "#8A8578" }}>
                {post.publishedAt ? formatDate(post.publishedAt) : ""}
              </span>
            </Link>
            {post.tags.length > 1 && (
              <div className="flex flex-wrap gap-2 sm:pl-[26px]">
                {post.tags.slice(1).map((tag) => (
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
        ))}
      </div>
    </FullBleedSection>
  );
}
