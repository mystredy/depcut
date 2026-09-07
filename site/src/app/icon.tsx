import { NextResponse } from "next/server";

import { iconSource } from "./_icon-source";

// Dynamic in place of a static favicon.ico file, so admin/settings/general's
// upload takes effect without a rebuild.
export const dynamic = "force-dynamic";

export default async function Icon() {
  const { data, contentType } = await iconSource("favicon", "default-favicon.ico");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      // An hour, not immutable: this key is overwritten in place on each
      // upload rather than content-addressed, so a replaced favicon needs
      // the old cache to actually expire.
      "Cache-Control": "public, max-age=3600",
      "Content-Type": contentType,
    },
  });
}
