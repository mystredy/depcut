import { NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { accountProfile } from "@/lib/account-profile";
import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { validationErrorResponse } from "@/lib/inference/responses";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The visible name is the product's own field. `name` keeps whatever Google
// gave us at sign-in — billing and the provider record depend on it — so a
// user renaming themselves writes `displayName`, and clearing it falls back to
// the Google name rather than blanking the account.
const updateProfileSchema = z.object({
  displayName: z.string().trim().max(60).nullable().optional(),
});

export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const profile = await accountProfile(request.depcut.userId);
  if (!profile) return notFoundResponse();
  return NextResponse.json(profile);
});

export const PUT = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const parsed = updateProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const userId = request.depcut.userId;
  const data: Prisma.UserUpdateInput = {};
  if ("displayName" in parsed.data) data.displayName = parsed.data.displayName || null;

  await prisma.user.update({ data, where: { id: userId } });

  return NextResponse.json(await accountProfile(userId));
});
