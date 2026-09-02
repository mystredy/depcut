import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only: every "Apply to be creator" submission, most recent
// first — the admin review queue at /admin/finance/creator-applications.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can view this." }, { status: 403 });
  }

  const rows = await prisma.creatorApplication.findMany({
    include: { user: { select: { displayName: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const applications = rows.map((r) => ({ ...r, applicantName: r.user.displayName || r.user.name, applicantEmail: r.user.email }));

  return NextResponse.json({ applications });
});
