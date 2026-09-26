import { NextResponse } from "next/server";
import { z } from "zod";

import { BLOG_THEMES, DEFAULT_BLOG_THEME } from "@/lib/blog/themes";
import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// Super-user only. The public blog's site-wide theme (see lib/blogSettings.ts
// for the cached public read /blog itself uses).
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const row = await prisma.blogSettings.upsert({
    create: { id: SINGLETON_ID },
    update: {},
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ theme: row.theme });
});

const themeIds = BLOG_THEMES.map((t) => t.id) as [string, ...string[]];
const bodySchema = z.object({ theme: z.enum(themeIds) });

export const PATCH = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request", message: "theme is required." }, { status: 400 });
  }

  const row = await prisma.blogSettings.upsert({
    create: { id: SINGLETON_ID, theme: parsed.data.theme },
    update: { theme: parsed.data.theme },
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ theme: row.theme ?? DEFAULT_BLOG_THEME });
});
