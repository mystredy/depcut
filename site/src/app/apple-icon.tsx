import { NextResponse } from "next/server";

import { iconSource } from "./_icon-source";

// Dynamic in place of a static apple-icon.png file — see icon.tsx, same
// reasoning. Shares the admin's uploaded favicon when there is one; falls
// back to its own bundled default otherwise (an .ico isn't something iOS
// reads as a touch icon, so this can't share icon.tsx's default file).
export const dynamic = "force-dynamic";

export default async function AppleIcon() {
  const { data, contentType } = await iconSource("default-apple-icon.png");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": contentType,
    },
  });
}
