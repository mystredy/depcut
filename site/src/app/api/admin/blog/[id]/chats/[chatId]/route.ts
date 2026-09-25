import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; chatId: string }> };

// Well above any real blog chat transcript (no image/audio data URLs like a
// Cut thread can carry) — just a backstop against a runaway conversation,
// not a real-world ceiling.
const MAX_THREAD_BYTES = 1_000_000;

async function requireSuperUser(userId: string) {
  if (await isDepCutSuperUser(userId)) return null;
  return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
}

// Lazily fetched once a thread is picked from the history flyout — the list
// route only ever hands back metadata.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  const forbidden = await requireSuperUser(request.depcut.userId);
  if (forbidden) return forbidden;

  const { id: postId, chatId } = await context.params;
  const thread = await prisma.blogChatThread.findUnique({ where: { id: chatId, postId } });
  if (!thread) return notFoundResponse();

  return NextResponse.json({ thread });
});

const putSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  data: z.unknown(),
});

// Saved once per settled turn (no per-token debounce needed — turns aren't
// streamed). id is client-generated (a UUID minted when "New chat" is
// clicked), so this is always the row's first write too — an upsert, not
// create-then-update.
export const PUT = withDepCutAuth(async (request, context: RouteContext) => {
  const forbidden = await requireSuperUser(request.depcut.userId);
  if (forbidden) return forbidden;

  const { id: postId, chatId } = await context.params;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const size = JSON.stringify(parsed.data.data ?? null).length;
  if (size > MAX_THREAD_BYTES) {
    return NextResponse.json({ error: "Chat thread too large." }, { status: 413 });
  }

  const data = (parsed.data.data ?? null) as object;
  await prisma.blogChatThread.upsert({
    create: {
      data,
      id: chatId,
      postId,
      title: parsed.data.title ?? "New chat",
      userId: request.depcut.userId,
    },
    update: { data, ...(parsed.data.title ? { title: parsed.data.title } : {}) },
    where: { id: chatId },
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  const forbidden = await requireSuperUser(request.depcut.userId);
  if (forbidden) return forbidden;

  const { id: postId, chatId } = await context.params;
  await prisma.blogChatThread.deleteMany({ where: { id: chatId, postId } });

  return NextResponse.json({ ok: true });
});
