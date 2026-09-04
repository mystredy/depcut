import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { listLegalPages } from "@/lib/pages/legal-pages";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds both legal pages from their source .mdx files
// on first read.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const pages = await listLegalPages();

  return NextResponse.json({ pages });
});
