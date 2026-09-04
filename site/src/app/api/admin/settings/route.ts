import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// The uploaded branding bytes never belong in this JSON payload — they're
// served as images from their own routes (/api/site/logo/[theme],
// /api/site/logo/compact, the /icon, /apple-icon, and /opengraph-image
// conventions), and Bytes fields don't serialize usefully here anyway.
// Shared by GET and PATCH so neither can drift and start returning them.
const OMIT_BRANDING_BYTES = {
  appleTouchIcon: true,
  appleTouchIconContentType: true,
  favicon: true,
  faviconContentType: true,
  logoCompact: true,
  logoCompactContentType: true,
  logoDark: true,
  logoDarkContentType: true,
  logoLight: true,
  logoLightContentType: true,
  socialShareImage: true,
  socialShareImageContentType: true,
} as const;

// Super-user only. Every field admin/settings/general exposes, one row.
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

const optionalUrl = z.union([z.literal(""), z.url().max(2000)]).optional();
const optionalEmail = z.union([z.literal(""), z.email().max(320)]).optional();

const socialLinksSchema = z
  .object({
    discord: optionalUrl,
    facebook: optionalUrl,
    instagram: optionalUrl,
    linkedin: optionalUrl,
    tiktok: optionalUrl,
    x: optionalUrl,
    youtube: optionalUrl,
  })
  .partial()
  .strict();

const updateSchema = z
  .object({
    appName: z.string().trim().min(1).max(200).optional(),
    tagline: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    websiteUrl: optionalUrl,
    supportEmail: optionalEmail,
    contactEmail: optionalEmail,
    adminEmail: z.string().trim().email().max(320).optional(),
    defaultLocale: z.string().trim().min(1).max(40).optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    dateFormat: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]).optional(),
    timeFormat: z.enum(["12h", "24h"]).optional(),
    defaultTheme: z.enum(["light", "dark", "system"]).optional(),
    accentColor: z
      .union([z.literal(""), z.string().trim().regex(/^#[0-9a-fA-F]{6}$/)])
      .optional(),
    copyrightText: z.string().trim().max(200).optional(),
    footerText: z.string().trim().max(500).optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceHeader: z.string().trim().max(200).optional(),
    maintenanceParagraph: z.string().trim().max(2000).optional(),
    maintenanceFooter: z.string().trim().max(500).optional(),
    allowRegistration: z.boolean().optional(),
    requireEmailVerification: z.boolean().optional(),
    defaultUserRole: z.string().trim().min(1).max(60).optional(),
    termsUrl: optionalUrl,
    privacyUrl: optionalUrl,
    cookiePolicyUrl: optionalUrl,
    helpCenterUrl: optionalUrl,
    socialLinks: socialLinksSchema.optional(),
    betaMode: z.boolean().optional(),
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

  // Empty string is the form's "cleared this field" — store it as unset
  // rather than as a blank string that still fails a future email/url check.
  const data: Record<string, unknown> = { ...parsed.data };
  for (const key of [
    "websiteUrl",
    "supportEmail",
    "contactEmail",
    "accentColor",
    "termsUrl",
    "privacyUrl",
    "cookiePolicyUrl",
    "helpCenterUrl",
  ]) {
    if (data[key] === "") data[key] = null;
  }

  const settings = await prisma.appSettings.upsert({
    create: { id: SINGLETON_ID, ...data },
    omit: OMIT_BRANDING_BYTES,
    update: data,
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});
