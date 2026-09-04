import { NextResponse } from "next/server";

import { iconSource } from "./_icon-source";

// Dynamic in place of a static favicon.ico file, so admin/settings/general's
// upload takes effect without a rebuild. Reads fresh every request — a
// favicon change is rare and cheap to check for, and Cache-Control below is
// what keeps browsers from re-fetching it constantly regardless.
export const dynamic = "force-dynamic";

export default async function Icon() {
  const { data, contentType } = await iconSource("default-favicon.ico");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": contentType,
    },
  });
}
