import { NextResponse } from "next/server";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { CATEGORY_SEED } from "@/lib/marketplace/categories-seed";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Self-seeding: the first read populates the Category table from
// CATEGORY_SEED if it's empty, then every read (this one included) serves
// straight from the database. Submit Project and Inspiration both call this
// instead of keeping their own hardcoded category list.
export const GET = withDonkeyAuth(async () => {
  const existing = await prisma.category.count();
  if (existing === 0) {
    await prisma.category.createMany({
      data: CATEGORY_SEED.map((c, i) => ({ ...c, sortOrder: i })),
      skipDuplicates: true,
    });
  }

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { emoji: true, id: true, name: true, niches: true },
  });

  return NextResponse.json({ categories });
});
