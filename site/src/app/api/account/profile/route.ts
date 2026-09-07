import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
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
//
// `username` is a separate, independent field — the stable @handle a Space is
// identified by, not derived from displayName (which can be anything and
// change freely). Both are optional in the request so a caller can update
// either one on its own.
const updateProfileSchema = z.object({
  displayName: z.string().trim().max(60).nullable().optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{2,19}$/, "3-20 characters: letters, numbers, underscores, starting with a letter")
    .nullable()
    .optional(),
});

/** True for a Prisma unique-constraint violation — same pattern
 * lib/flows/submit.ts uses for its own unique inserts. */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

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
  if ("username" in parsed.data) data.username = parsed.data.username || null;

  try {
    await prisma.user.update({ data, where: { id: userId } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "username_taken", message: "That username is taken." },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json(await accountProfile(userId));
});
