import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram/notify";

export const dynamic = "force-dynamic";

// The client crops nothing here — a raw screenshot paste or file pick — so
// the cap is generous next to the avatar upload's, not a backstop against a
// path that already resizes.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const createSchema = z
  .object({
    subject: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(4000),
    attachment: z
      .object({
        data: z.string().min(1),
        contentType: z.string().refine((t) => ALLOWED_ATTACHMENT_TYPES.has(t), {
          message: "Unsupported image type.",
        }),
      })
      .optional(),
  })
  .strict();

// Selected explicitly so a ticket list never carries the attachment's raw
// bytes — just whether one exists, for a link to the route that serves it.
const listSelect = {
  id: true,
  number: true,
  subject: true,
  message: true,
  status: true,
  response: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  attachmentContentType: true,
} as const;

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

  let attachmentData: Uint8Array<ArrayBuffer> | undefined;
  const { attachment, ...fields } = parsed.data;
  if (attachment) {
    // Prisma's Bytes input wants a Uint8Array<ArrayBuffer> specifically; a
    // fresh ArrayBuffer copy sidesteps Buffer's wider (and here, pooled)
    // ArrayBufferLike typing.
    const bytes = Buffer.from(attachment.data, "base64");
    attachmentData = new Uint8Array(new ArrayBuffer(bytes.byteLength));
    attachmentData.set(bytes);
    if (attachmentData.byteLength === 0 || attachmentData.byteLength > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: "Image too large." }, { status: 413 });
    }
  }

  const [ticket, user] = await Promise.all([
    prisma.supportTicket.create({
      data: {
        ...fields,
        userId: request.donkey.userId,
        attachmentData,
        attachmentContentType: attachment?.contentType,
      },
      select: listSelect,
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
    select: listSelect,
    where: { userId: request.donkey.userId },
  });

  return NextResponse.json({ tickets });
});
