import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only: every Upload (the Pro Verification Suite's publishing
// package) with its Posts, for the admin's manual publish-tracking page.
// There's no per-platform API integration yet, so this is how a publisher
// records what actually went out until that pipeline exists.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const uploads = await prisma.upload.findMany({
    include: {
      posts: { orderBy: { createdAt: "asc" } },
      submission: { select: { id: true, title: true, user: { select: { email: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ uploads });
});
