import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram/notify";

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

  const [ticket, user] = await Promise.all([
    prisma.supportTicket.create({
      data: { ...parsed.data, userId: request.donkey.userId },
    }),
    prisma.user.findUnique({
      select: { displayName: true, email: true, name: true },
      where: { id: request.donkey.userId },
    }),
  ]);

  const requesterName = user?.displayName || user?.name || user?.email || "a user";
  await notifyTelegram("supportTicket", `🆘 Support ticket: "${ticket.subject}" from ${requesterName}`);

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
