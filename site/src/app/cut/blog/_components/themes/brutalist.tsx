import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { THEME_FONTS } from "./fonts";
import { coverUrl, formatDate, FullBleedSection, type BlogListPost } from "./shared";

const ACCENT = "#E8FF3D";
const HEADLINE = THEME_FONTS.brutalist.headline;
const BODY = THEME_FONTS.brutalist.body;

export function BrutalistList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#FFFFFF">
      <div
        className="flex flex-col gap-7"
        style={{ color: "#000000", fontFamily: BODY }}
      >
        <div className="flex items-center justify-between pb-3.5" style={{ borderBottom: "4px solid #000000" }}>
          <span
            className="text-[20px] font-bold uppercase"
            style={{ fontFamily: HEADLINE }}
          >
            DepCut / Blog
          </span>
          <span className="text-[11px] font-medium">
            {String(posts.length).padStart(3, "0")} posts
          </span>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => {
            const cover = coverUrl(post);
            const featured = i % 3 === 2;
            return (
              <div key={post.id} className="flex flex-col gap-2.5">
                <Link
                  href={`/blog/${post.slug}`}
                  className="block no-underline transition-transform hover:-translate-x-[3px] hover:-translate-y-[3px]"
                  style={{
                    border: "3px solid #000000",
                    boxShadow: "6px 6px 0 #000000",
                    background: featured ? ACCENT : "#FFFFFF",
                  }}
                >
                  <div className="h-3" style={{ background: "#000000" }} />
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable one
                    <img src={cover} alt="" className="h-32 w-full object-cover" style={{ borderBottom: "3px solid #000000" }} />
                  )}
                  <div className="flex flex-col gap-2.5 p-[18px]">
                    <span className="text-[10px] font-bold tracking-[0.06em] uppercase">
                      {String(i + 1).padStart(2, "0")} / {post.tags[0] ?? "post"}
                    </span>
                    <h2
                      className="text-[19px] leading-[1.2] font-bold uppercase"
                      style={{ fontFamily: HEADLINE }}
                    >
                      {post.title}
                    </h2>
                    <span className="mt-1.5 text-[10.5px] font-medium">
                      {post.publishedAt ? formatDate(post.publishedAt) : ""}
                    </span>
                  </div>
                </Link>
                {post.tags.length > 1 && (
                  <div className="flex flex-wrap gap-2.5">
                    {post.tags.slice(1).map((tag) => (
                      <Link
                        key={tag}
                        href={`/blog/category/${categorySlug(tag)}`}
                        className="text-[11px] font-medium no-underline hover:underline"
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
