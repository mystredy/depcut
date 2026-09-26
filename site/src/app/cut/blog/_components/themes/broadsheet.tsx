import Link from "next/link";

import { categorySlug } from "@/lib/blog/categories";

import { coverUrl, formatDate, FullBleedSection, type BlogListPost } from "./shared";

const ACCENT = "#B3261E";

function TagRow({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
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
  );
}

// One lead story beside a stacked sidebar — the layout genuinely doesn't
// generalize to a grid, so this theme owns a lead + rest split instead
// (scales to any post count: the sidebar just grows).
export function BroadsheetList({ posts }: { posts: BlogListPost[] }) {
  const [lead, ...rest] = posts;
  const leadCover = lead ? coverUrl(lead) : null;
  return (
    <FullBleedSection background="#FCFBF8">
      <div className="flex flex-col gap-6" style={{ color: "#14110F" }}>
        <div
          className="flex flex-col items-center gap-2.5 pb-3.5"
          style={{ borderBottom: "3px double #14110F" }}
        >
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 800 }}>
            The DepCut Times
          </span>
          <span className="text-[10.5px] font-medium tracking-[0.14em] uppercase" style={{ color: "#6B6558" }}>
            Product &amp; Engineering
          </span>
        </div>
        <div className="flex flex-col gap-10 lg:flex-row">
          {lead && (
            <div
              className="flex flex-col gap-3 lg:flex-[1.6] lg:pr-10"
              style={{ borderRight: rest.length > 0 ? "1px solid #DDD8CB" : undefined }}
            >
              <Link href={`/blog/${lead.slug}`} className="flex flex-col gap-3 no-underline">
                {leadCover && (
                  // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable one
                  <img src={leadCover} alt="" className="mb-1 h-56 w-full rounded object-cover" />
                )}
                {lead.tags[0] && (
                  <span className="text-[10.5px] font-bold tracking-[0.1em] uppercase" style={{ color: ACCENT }}>
                    Lead Story · {lead.tags[0]}
                  </span>
                )}
                <h2
                  className="text-[32px] leading-[1.15] font-bold"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {lead.title}
                </h2>
                {lead.excerpt && (
                  <p className="text-[13.5px] leading-[1.6]" style={{ color: "#4A463D" }}>
                    {lead.excerpt}
                  </p>
                )}
                <p className="mt-1 text-[11.5px]" style={{ color: "#8A8578" }}>
                  By {lead.authorName ?? "DepCut Team"}
                  {lead.publishedAt ? ` · ${formatDate(lead.publishedAt)}` : ""}
                </p>
              </Link>
              <TagRow tags={lead.tags} />
            </div>
          )}
          {rest.length > 0 && (
            <div className="flex flex-1 flex-col gap-5">
              {rest.map((post, i) => {
                const cover = coverUrl(post);
                return (
                  <div
                    key={post.id}
                    className="flex flex-col gap-2 pb-5"
                    style={{ borderBottom: i === rest.length - 1 ? undefined : "1px solid #DDD8CB" }}
                  >
                    <Link href={`/blog/${post.slug}`} className="flex gap-3 no-underline">
                      {cover && (
                        // eslint-disable-next-line @next/next/no-img-element -- a presigned/admin-uploaded asset, not a Next-optimizable one
                        <img src={cover} alt="" className="h-16 w-20 shrink-0 rounded object-cover" />
                      )}
                      <div className="flex flex-col gap-1.5">
                        {post.tags[0] && (
                          <span className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: ACCENT }}>
                            {post.tags[0]}
                          </span>
                        )}
                        <h3
                          className="text-[16.5px] leading-[1.25] font-bold"
                          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                        >
                          {post.title}
                        </h3>
                        <span className="text-[11px]" style={{ color: "#8A8578" }}>
                          {post.publishedAt ? formatDate(post.publishedAt) : ""}
                        </span>
                      </div>
                    </Link>
                    <TagRow tags={post.tags} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </FullBleedSection>
  );
}
