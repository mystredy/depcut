import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { getObject, socialShareImageKey } from "@/cut/server/cloud/r2";
import { publicSiteSettings } from "@/lib/siteSettings";

export const SOCIAL_IMAGE_SIZE = { height: 630, width: 1200 };

/** Shared by opengraph-image.tsx and twitter-image.tsx — Next.js resolves
 * them as two independent conventions with no fallback between them, so both
 * files call this rather than one aliasing the other. Serves the
 * admin-uploaded social share image (admin/settings/general) as-is, or a
 * plain rendered text card naming the site when nothing's been uploaded. The
 * image itself lives in R2 (see the site logo route's own migration for why);
 * publicSiteSettings for the rendered fallback's appName/tagline is already
 * cached and fails closed to defaults on a DB error, so this never blocks a
 * card render on a live query the way a raw Prisma read would. */
export async function siteShareImage(): Promise<Response> {
  const object = await getObject(socialShareImageKey());
  if (object) {
    return new NextResponse(new Uint8Array(object.bytes), {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": object.mime,
      },
    });
  }

  const settings = await publicSiteSettings();

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#F5EFE6",
          color: "#0F0E0D",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700 }}>{settings?.appName ?? "DepCut"}</div>
        {settings?.tagline ? (
          <div style={{ color: "#666666", fontSize: 36, marginTop: 24 }}>{settings.tagline}</div>
        ) : null}
      </div>
    ),
    { ...SOCIAL_IMAGE_SIZE }
  );
}
