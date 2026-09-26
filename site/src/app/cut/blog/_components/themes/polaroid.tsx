import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { CAVEAT_FONT, THEME_FONTS } from "./fonts";
import { coverUrl, FullBleedSection, type BlogListPost } from "./shared";

const BLOCKS = ["#FF8B6B", "#6BC7B8", "#B3A6E0"];
const ROTATIONS = ["-2deg", "2deg", "-1deg"];
const ACCENT = "#D6455D";
const HEADLINE = THEME_FONTS.polaroid.headline;

export function PolaroidList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#FDF6EC">
      <div className="flex flex-col gap-9" style={{ color: "#2B241C" }}>
        <span style={{ fontFamily: HEADLINE, fontSize: 22, fontWeight: 700 }}>
          DepCut Blog
        </span>
        <div className="flex flex-wrap items-start gap-10">
          {posts.map((post, i) => {
            const cover = coverUrl(post);
            return (
              <div key={post.id} className="flex w-[240px] flex-col gap-2">
                <Link
                  href={`/blog/${post.slug}`}
                  className="block bg-white px-3.5 pt-3.5 pb-5 no-underline transition-transform hover:!rotate-0"
                  style={{
                    transform: `rotate(${ROTATIONS[i % ROTATIONS.length]})`,
                    boxShadow: "0 6px 18px rgba(43,36,28,0.12)",
                  }}
                >
                  <div
                    className="flex h-[150px] items-center justify-center overflow-hidden"
                    style={{ background: BLOCKS[i % BLOCKS.length] }}
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable one
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    )}
                  </div>
                  {post.tags[0] && (
                    <p className="mt-3 text-[19px]" style={{ fontFamily: CAVEAT_FONT, color: ACCENT }}>
                      {post.tags[0]}
                    </p>
                  )}
                  <h2
                    className="mt-0.5 text-[16px] leading-[1.3] font-semibold"
                    style={{ fontFamily: HEADLINE }}
                  >
                    {post.title}
                  </h2>
                </Link>
                {post.tags.length > 1 && (
                  <div className="flex flex-wrap gap-2 px-1">
                    {post.tags.slice(1).map((tag) => (
                      <Link
                        key={tag}
                        href={`/blog/category/${categorySlug(tag)}`}
                        className="text-[11.5px] no-underline hover:underline"
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
