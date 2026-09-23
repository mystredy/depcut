#!/usr/bin/env bun
/**
 * One-off: copy BlogPost.tag (the old single-tag field) into the new
 * BlogPost.tags array for rows that predate it. Idempotent — only touches
 * rows where tags is still empty and tag is set, so re-running or listing an
 * already-migrated post is a no-op.
 *
 * Requires the tags column to already exist on the live database (added by
 * hand, per this repo's manual-migrations rule — see prisma/schema.prisma).
 *
 * Run from site/ with production credentials in the environment:
 *   bun run scripts/backfill-blog-tags.ts
 */

import { prisma } from "../src/lib/prisma";

const posts = await prisma.blogPost.findMany({
  select: { id: true, tag: true, tags: true, title: true },
  where: { tag: { not: null }, tags: { equals: [] } },
});

for (const post of posts) {
  await prisma.blogPost.update({ data: { tags: [post.tag!] }, where: { id: post.id } });
  console.log(`${post.id} (${post.title}): tag "${post.tag}" -> tags`);
}

console.log(`Done — migrated ${posts.length} post(s).`);
await prisma.$disconnect();
