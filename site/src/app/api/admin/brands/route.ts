import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const connectionSelect = {
  accountHandle: true,
  accountName: true,
  id: true,
  platform: true,
} as const;

// Super-user only. Named groups of SocialConnections — posting to a brand
// is meant to fan out to every connection in it, but that publish pipeline
// doesn't exist yet; this is just the grouping.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const brands = await prisma.brand.findMany({
    include: { connections: { select: connectionSelect } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    brands: brands.map(({ logo, logoContentType: _logoContentType, ...b }) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      hasLogo: Boolean(logo),
      updatedAt: b.updatedAt.toISOString(),
    })),
  });
});

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    username: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-zA-Z0-9_.]+$/, "Letters, numbers, underscores, and periods only"),
  })
  .strict();

export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const [nameTaken, usernameTaken] = await Promise.all([
    prisma.brand.findUnique({ select: { id: true }, where: { name: parsed.data.name } }),
    prisma.brand.findUnique({ select: { id: true }, where: { username: parsed.data.username } }),
  ]);
  if (nameTaken || usernameTaken) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: [
          ...(nameTaken ? [{ message: "That brand name is already taken.", path: "name" }] : []),
          ...(usernameTaken ? [{ message: "That username is already taken.", path: "username" }] : []),
        ],
      },
      { status: 400 },
    );
  }

  const { logo, logoContentType: _logoContentType, ...brand } = await prisma.brand.create({
    data: parsed.data,
    include: { connections: { select: connectionSelect } },
  });

  return NextResponse.json({
    brand: {
      ...brand,
      createdAt: brand.createdAt.toISOString(),
      hasLogo: Boolean(logo),
      updatedAt: brand.updatedAt.toISOString(),
    },
  });
});
