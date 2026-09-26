"use client";

import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BLOG_THEMES, DEFAULT_BLOG_THEME, type BlogThemeId } from "@/lib/blog/themes";
import { useBlogTheme, useUpdateBlogTheme } from "@/queries/admin";

export default function AdminBlogThemePage() {
  const theme = useBlogTheme();
  const update = useUpdateBlogTheme();
  const current = theme.data?.theme ?? DEFAULT_BLOG_THEME;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Blog theme</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One theme applies site-wide to /blog and every category page. Picking a new one takes
            effect within a minute — nothing to redeploy.
          </p>
        </div>
        <a
          href="/blog"
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          <ExternalLink className="size-3.5" data-icon="inline-start" />
          View blog
        </a>
      </div>

      {theme.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : theme.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the current theme. Try again.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BLOG_THEMES.map((t) => {
            const selected = t.id === current;
            const saving = update.isPending && update.variables === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={update.isPending}
                onClick={() => {
                  if (!selected) update.mutate(t.id as BlogThemeId);
                }}
                className={cn(
                  "flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-colors disabled:opacity-60",
                  selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-input",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{t.label}</span>
                  {selected && <Check className="size-3.5 shrink-0 text-primary" />}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                {saving && <p className="text-[11px] text-muted-foreground">Saving…</p>}
              </button>
            );
          })}
        </div>
      )}

      {update.isError && (
        <p className="text-sm text-destructive">Could not save that theme. Try again.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Themes reskin the post grid/list only — the post reading page (
        <Link href="/blog" className="underline hover:no-underline">
          /blog/[slug]
        </Link>
        ) keeps its current design for every theme.
      </p>
    </div>
  );
}
