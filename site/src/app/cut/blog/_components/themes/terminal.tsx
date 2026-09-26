import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { THEME_FONTS } from "./fonts";
import { FullBleedSection, type BlogListPost } from "./shared";

const ACCENT = "#5FD97A";
const BODY = THEME_FONTS.terminal.body;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Darker than the page's own background (near-black rather than plain
// black-ish), so it still gets a full-bleed section rather than blending
// straight into BlogShell's chrome.
export function TerminalList({ posts }: { posts: BlogListPost[] }) {
  return (
    <FullBleedSection background="#0A0E0C">
      <div className="flex flex-col gap-6" style={{ color: "#C9D1C9", fontFamily: BODY }}>
        <div className="flex items-center gap-2.5">
          <span className="size-[9px] rounded-full" style={{ background: ACCENT }} />
          <span className="text-[13.5px] font-semibold" style={{ color: "#E4EAE4" }}>
            depcut/blog
          </span>
          <span className="text-[12px]" style={{ color: "#56605A" }}>
            — changelog
          </span>
        </div>
        {posts.map((post) => (
          <div key={post.id} className="flex flex-col gap-1.5">
            <Link
              href={`/blog/${post.slug}`}
              className="flex flex-col gap-1.5 no-underline"
              style={{ border: "1px solid #1D2420", borderLeft: "2px solid #1D2420", padding: "16px 18px" }}
            >
              <span className="text-[12px]" style={{ color: ACCENT }}>
                $ posts/{slugify(post.title)}
                {post.tags[0] && <span style={{ color: "#56605A" }}> --tag {categorySlug(post.tags[0])}</span>}
              </span>
              <span className="text-[17px] font-semibold" style={{ color: "#E4EAE4" }}>
                &gt; {post.title}
              </span>
              {post.excerpt && (
                <span className="text-[12px] leading-[1.6]" style={{ color: "#7C877E" }}>
                  {post.excerpt}
                </span>
              )}
              <span className="mt-1 text-[11px]" style={{ color: "#56605A" }}>
                {post.publishedAt ? post.publishedAt.toISOString().slice(0, 10) : ""}
                {post.authorName ? ` · ${post.authorName.toLowerCase().replace(/\s+/g, "-")}` : ""}
              </span>
            </Link>
            {post.tags.length > 1 && (
              <div className="flex flex-wrap gap-3 px-[18px]">
                {post.tags.slice(1).map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog/category/${categorySlug(tag)}`}
                    className="text-[11px] no-underline hover:underline"
                    style={{ color: "#56605A" }}
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
