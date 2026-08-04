import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// Super-user only. General app identity + maintenance-mode copy, one row.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const settings = await prisma.appSettings.upsert({
    create: { id: SINGLETON_ID },
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

export const PATCH = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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
    update: parsed.data,
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});
