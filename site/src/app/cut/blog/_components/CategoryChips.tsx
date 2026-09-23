import Link from "next/link";

import { cn } from "@/lib/utils";
import type { BlogCategory } from "@/lib/blog/categories";

const CHIP = "rounded-full border px-3 py-1 text-[12px] font-medium no-underline transition-colors";
const CHIP_IDLE = "border-white/15 text-white/60 hover:border-white/30 hover:text-white";
const CHIP_ACTIVE = "border-white/25 bg-white/10 text-white";

// The filter row on /blog and /blog/category/[slug] — each chip links
// straight to that category's own page rather than filtering client-side,
// so the filtered view stays a plain, indexable, cacheable page.
export function CategoryChips({ categories, activeSlug }: { categories: BlogCategory[]; activeSlug?: string }) {
  if (categories.length === 0) return null;

  return (
    <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
      <Link href="/blog" className={cn(CHIP, activeSlug === undefined ? CHIP_ACTIVE : CHIP_IDLE)}>
        All posts
      </Link>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/blog/category/${category.slug}`}
          className={cn(CHIP, activeSlug === category.slug ? CHIP_ACTIVE : CHIP_IDLE)}
        >
          {category.label} <span className="text-white/30">· {category.count}</span>
        </Link>
      ))}
    </div>
  );
}
