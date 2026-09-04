import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const SOCIAL_IMAGE_SIZE = { height: 630, width: 1200 };

const SINGLETON_ID = "singleton";

/** Shared by opengraph-image.tsx and twitter-image.tsx — Next.js resolves
 * them as two independent conventions with no fallback between them, so both
 * files call this rather than one aliasing the other. Serves the
 * admin-uploaded social share image (admin/settings/general) as-is, or a
 * plain rendered text card naming the site when nothing's been uploaded. */
export async function siteShareImage(): Promise<Response> {
  const settings = await prisma.appSettings.findUnique({
    select: {
      appName: true,
      socialShareImage: true,
      socialShareImageContentType: true,
      tagline: true,
    },
    where: { id: SINGLETON_ID },
  });

  if (settings?.socialShareImage && settings.socialShareImageContentType) {
    return new NextResponse(new Uint8Array(settings.socialShareImage), {
      headers: { "Content-Type": settings.socialShareImageContentType },
    });
  }

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
