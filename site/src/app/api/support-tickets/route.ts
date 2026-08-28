import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegramWithMedia } from "@/lib/telegram/notify";

export const dynamic = "force-dynamic";

// The client crops nothing here — a raw screenshot paste or file pick — so
// the cap is generous next to the avatar upload's, not a backstop against a
// path that already resizes.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 7;
const ALLOWED_ATTACHMENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const createSchema = z
  .object({
    subject: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(4000),
    attachments: z
      .array(
        z.object({
          data: z.string().min(1),
          contentType: z.string().refine((t) => ALLOWED_ATTACHMENT_TYPES.has(t), {
            message: "Unsupported image type.",
          }),
        })
      )
      .max(MAX_ATTACHMENTS)
      .optional(),
  })
  .strict();

// Selected explicitly so a ticket list never carries attachment bytes — just
// each one's id and content type, enough to link to the route that serves it.
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
  attachments: { select: { id: true, contentType: true } },
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

  const { attachments: rawAttachments, ...fields } = parsed.data;
  // A fresh ArrayBuffer copy per file — Prisma's Bytes input wants a
  // Uint8Array<ArrayBuffer> specifically, which sidesteps Buffer's wider
  // (and here, pooled) ArrayBufferLike typing.
  const attachments = (rawAttachments ?? []).map((a) => {
    const bytes = Buffer.from(a.data, "base64");
    const data = new Uint8Array(new ArrayBuffer(bytes.byteLength));
    data.set(bytes);
    return { contentType: a.contentType, data };
  });
  if (attachments.some((a) => a.data.byteLength === 0 || a.data.byteLength > MAX_ATTACHMENT_BYTES)) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  const [ticket, user] = await Promise.all([
    prisma.supportTicket.create({
      data: {
        ...fields,
        userId: request.donkey.userId,
        attachments: { create: attachments.map((a) => ({ contentType: a.contentType, data: a.data })) },
      },
      select: listSelect,
    }),
    prisma.user.findUnique({
      select: { displayName: true, email: true, name: true },
      where: { id: request.donkey.userId },
    }),
  ]);

  const requesterName = user?.displayName || user?.name || user?.email || "a user";
  const detailText = `🆘 Support ticket TKT-${1000 + ticket.number} from ${requesterName}\n${ticket.subject}\n\n${ticket.message}`;
  await notifyTelegramWithMedia("supportTicket", detailText, attachments);

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
