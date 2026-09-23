import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeTags } from "@/lib/blog/categories";
import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every post, published or draft — the public /blog routes
// have their own direct Prisma reads (see cut/blog/page.tsx) filtered to
// published: true; this list is the admin's, unfiltered.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const posts = await prisma.blogPost.findMany({
    include: { createdBy: { select: { displayName: true, id: true, image: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ posts });
});

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).regex(slugPattern, "Use lowercase letters, numbers, and hyphens only."),
  excerpt: z.string().trim().max(500).optional(),
  contentMarkdown: z.string().trim().min(1).max(200_000),
  authorName: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  published: z.boolean().default(false),
});

export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  const clash = await prisma.blogPost.findUnique({ select: { id: true }, where: { slug: body.slug } });
  if (clash) {
    return NextResponse.json({ error: "Slug already in use." }, { status: 409 });
  }

  const post = await prisma.blogPost.create({
    data: {
      authorName: body.authorName || null,
      contentMarkdown: body.contentMarkdown,
      createdByUserId: request.depcut.userId,
      excerpt: body.excerpt || null,
      published: body.published,
      publishedAt: body.published ? new Date() : null,
      slug: body.slug,
      tags: normalizeTags(body.tags ?? []),
      title: body.title,
    },
    include: { createdBy: { select: { displayName: true, id: true, image: true, name: true } } },
  });

  return NextResponse.json({ post }, { status: 201 });
});
