import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// The uploaded branding bytes never belong in this JSON payload — they're
// served as images from their own routes (/api/site/logo/[theme], the /icon
// and /apple-icon conventions), and Bytes fields don't serialize usefully
// here anyway. Shared by GET and PATCH so neither can drift and start
// returning them.
const OMIT_BRANDING_BYTES = {
  favicon: true,
  faviconContentType: true,
  logoDark: true,
  logoDarkContentType: true,
  logoLight: true,
  logoLightContentType: true,
} as const;

// Super-user only. General app identity + maintenance-mode copy, one row.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const settings = await prisma.appSettings.upsert({
    create: { id: SINGLETON_ID },
    omit: OMIT_BRANDING_BYTES,
    update: {},
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});

const updateSchema = z
  .object({
    appName: z.string().trim().min(1).max(200).optional(),
    adminEmail: z.string().trim().email().max(320).optional(),
    defaultLocale: z.string().trim().min(1).max(40).optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceHeader: z.string().trim().max(200).optional(),
    maintenanceParagraph: z.string().trim().max(2000).optional(),
    maintenanceFooter: z.string().trim().max(500).optional(),
  })
  .strict();

export const PATCH = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const settings = await prisma.appSettings.upsert({
    create: { id: SINGLETON_ID, ...parsed.data },
    omit: OMIT_BRANDING_BYTES,
    update: parsed.data,
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});
