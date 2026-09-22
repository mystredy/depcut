import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { blogCoverKey, del } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).regex(slugPattern, "Use lowercase letters, numbers, and hyphens only.").optional(),
  excerpt: z.string().trim().max(500).nullable().optional(),
  contentMarkdown: z.string().trim().min(1).max(200_000).optional(),
  authorName: z.string().trim().max(120).nullable().optional(),
  tag: z.string().trim().max(60).nullable().optional(),
  published: z.boolean().optional(),
});

export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) return notFoundResponse();

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  if (body.slug && body.slug !== existing.slug) {
    const clash = await prisma.blogPost.findUnique({ select: { id: true }, where: { slug: body.slug } });
    if (clash) {
      return NextResponse.json({ error: "Slug already in use." }, { status: 409 });
    }
  }

  // Publishing for the first time stamps publishedAt; unpublishing keeps the
  // original stamp so a republish doesn't look freshly posted.
  const publishedAt =
    body.published === true && !existing.published
      ? new Date()
      : body.published === false
        ? existing.publishedAt
        : existing.publishedAt;

  const post = await prisma.blogPost.update({
    data: {
      authorName: body.authorName === undefined ? undefined : body.authorName || null,
      contentMarkdown: body.contentMarkdown,
      // A row from before the creator link existed has no owner on record —
      // credit whoever touches it first rather than leave it blank forever.
      createdByUserId: existing.createdByUserId ?? request.depcut.userId,
      excerpt: body.excerpt === undefined ? undefined : body.excerpt || null,
      published: body.published,
      publishedAt,
      slug: body.slug,
      tag: body.tag === undefined ? undefined : body.tag || null,
      title: body.title,
    },
    include: { createdBy: { select: { displayName: true, id: true, image: true, name: true } } },
    where: { id },
  });

  return NextResponse.json({ post });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.blogPost.findUnique({ select: { hasCoverImage: true, id: true }, where: { id } });
  if (!existing) return notFoundResponse();

  // The row goes first here (unlike a media asset with its own confirmed-
  // deleted-before-row-removed order): an orphaned cover object is harmless
  // dead weight in R2, but a row pointing at bytes that got deleted first
  // would 404 on every render until cleanup ran.
  await prisma.blogPost.delete({ where: { id } });
  if (existing.hasCoverImage) {
    await del([blogCoverKey(id)]);
  }

  return NextResponse.json({ ok: true });
});
