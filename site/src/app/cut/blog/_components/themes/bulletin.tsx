import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { coverUrl, formatDate, FullBleedSection, type BlogListPost } from "./shared";

const COVER_COLORS = ["#FF5A36", "#16130F", "#C9C4B4"];
const ACCENT = "#FF5A36";

export function BulletinList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#FFFFFF">
      <div
        className="flex flex-col gap-8"
        style={{ color: "#16130F", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
      >
        <div
          className="flex items-center justify-between pb-3.5"
          style={{ borderBottom: "3px solid #16130F" }}
        >
          <span
            className="text-[20px] font-black tracking-[-0.01em] uppercase"
            style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}
          >
            DepCut Bulletin
          </span>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => {
            const cover = coverUrl(post);
            const blockColor = COVER_COLORS[i % COVER_COLORS.length];
            return (
              <div key={post.id} className="flex flex-col gap-2.5">
                <Link href={`/blog/${post.slug}`} className="flex flex-col gap-2.5 no-underline">
                  <div className="relative flex h-[156px] items-center justify-center" style={{ background: blockColor }}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable one
                      <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    )}
                    {post.tags[0] && (
                      <span
                        className="absolute bottom-3 left-3 px-[9px] py-1 text-[10px] font-bold tracking-[0.08em] uppercase"
                        style={{ background: "#16130F", color: "#FFFFFF" }}
                      >
                        {post.tags[0]}
                      </span>
                    )}
                  </div>
                  <h2
                    className="text-[19px] leading-[1.15] font-black tracking-[-0.01em]"
                    style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}
                  >
                    {post.title}
                  </h2>
                  <p className="text-[12px]" style={{ color: "#6B6558" }}>
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
                        className="text-[11px] font-semibold no-underline hover:underline"
                        style={{ color: ACCENT }}
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
