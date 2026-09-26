import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { coverUrl, formatDate, FullBleedSection, type BlogListPost } from "./shared";

const STRIPES = [
  { bar: "#3B6EF6", chip: "rgba(59,110,246,0.1)", text: "#3B6EF6" },
  { bar: "#1E9E6D", chip: "rgba(30,158,109,0.1)", text: "#1E9E6D" },
  { bar: "#7B5CFA", chip: "rgba(123,92,250,0.1)", text: "#7B5CFA" },
];

function initials(name: string | null): string {
  if (!name) return "DC";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "DC";
}

export function DeckList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#FBFAF8">
      <div className="flex flex-col gap-8" style={{ color: "#16130F" }}>
        <span className="text-[17px] font-bold" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
          Blog
        </span>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => {
            const cover = coverUrl(post);
            const stripe = STRIPES[i % STRIPES.length];
            return (
              <div
                key={post.id}
                className="flex flex-col overflow-hidden rounded-2xl bg-white transition-shadow hover:-translate-y-0.5"
                style={{ boxShadow: "0 1px 2px rgba(20,17,15,0.04), 0 8px 24px rgba(20,17,15,0.06)" }}
              >
                <Link href={`/blog/${post.slug}`} className="flex flex-col no-underline">
                  <div className="h-1.5" style={{ background: stripe.bar }} />
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable one
                    <img src={cover} alt="" className="h-32 w-full object-cover" />
                  )}
                  <div className="flex flex-col gap-3 p-5">
                    {post.tags[0] && (
                      <span
                        className="self-start rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: stripe.chip, color: stripe.text }}
                      >
                        {post.tags[0]}
                      </span>
                    )}
                    <h2
                      className="text-[17px] leading-[1.35] font-semibold"
                      style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
                    >
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="line-clamp-2 text-[12.5px] leading-[1.5]" style={{ color: "#6B6558" }}>
                        {post.excerpt}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className="grid size-[22px] place-items-center rounded-full text-[10px] font-semibold text-white"
                        style={{ background: stripe.bar, fontFamily: "'Sora', system-ui, sans-serif" }}
                      >
                        {initials(post.authorName)}
                      </span>
                      <span className="text-[11.5px]" style={{ color: "#8A8578" }}>
                        {post.publishedAt ? formatDate(post.publishedAt) : ""}
                      </span>
                    </div>
                  </div>
                </Link>
                {post.tags.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 px-5 pb-5">
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
            );
          })}
        </div>
      </div>
    </FullBleedSection>
  );
}
