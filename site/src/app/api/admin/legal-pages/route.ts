import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { listLegalPages } from "@/lib/pages/legal-pages";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds both legal pages from their source .mdx files
// on first read.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const pages = await listLegalPages();

  return NextResponse.json({ pages });
});
