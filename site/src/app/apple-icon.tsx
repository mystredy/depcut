import { NextResponse } from "next/server";

import { iconSource } from "./_icon-source";

// Dynamic in place of a static apple-icon.png file — see icon.tsx, same
// reasoning. Its own independent upload (admin/settings/general), not
// derived from the favicon — see _icon-source.ts.
export const dynamic = "force-dynamic";

export default async function AppleIcon() {
  const { data, contentType } = await iconSource("appleTouchIcon", "default-apple-icon.png");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": contentType,
    },
  });
}
