import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    subject: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(4000),
  })
  .strict();

export const POST = withDonkeyAuth(async (request) => {
  const parsed = createSchema.safeParse(await request.json());
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

  const ticket = await prisma.supportTicket.create({
    data: { ...parsed.data, userId: request.donkey.userId },
  });

  return NextResponse.json({ ticket });
});

// The signed-in user's own tickets, newest first.
export const GET = withDonkeyAuth(async (request) => {
  const tickets = await prisma.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    where: { userId: request.donkey.userId },
  });

  return NextResponse.json({ tickets });
});
