// Submits a Flow generation and lands its result — the glue between a
// FlowGeneration row and the inference gateway. Deliberately reuses the
// existing /api/inference/assets(/refresh) route handlers IN PROCESS (a real
// NextRequest built from the caller's own, then handed straight to the
// imported handler function — no network hop) rather than re-deriving their
// credit-charging and provider-call logic here: that logic is billing-
// critical and already shipped, and duplicating it is exactly how the two
// paths would quietly drift apart. See docs/guides/backend-apis.md's
// "State stays on the client" rule — this is the one place in the codebase
// that runs against it on purpose, because a Flow is explicitly a server-
// persisted thread; that's the whole feature.
import { NextRequest } from "next/server";

import { POST as submitAsset } from "@/app/api/inference/assets/route";
import { POST as refreshAsset } from "@/app/api/inference/assets/refresh/route";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { maybeSetAutoCover } from "@/lib/flows/db";
import { flowMediaKey, putObject } from "@/cut/server/cloud/r2";

/** True for a Prisma unique-constraint violation — same pattern
 * lib/credits/inference.ts uses for its own idempotent grant inserts. */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const DONKEY_CLIENT_ID = "donkey-cut";

type GenerationOutput = { dataBase64?: string; url?: string; contentType?: string };
type AssetGenerationResult = {
  id: string;
  status: "in_progress" | "completed" | "failed";
  provider: string;
  model: string;
  providerJobId: string | null;
  providerGenerationId: string | null;
  providerPollingUrl: string | null;
  outputs: GenerationOutput[];
  error?: unknown;
  metadata?: Record<string, unknown>;
};

/** A fresh in-process request to an inference-gateway route, carrying the
 * calling request's own auth (cookie or api-key) forward. */
function innerRequest(originalHeaders: Headers, path: string, body: unknown): NextRequest {
  const headers = new Headers(originalHeaders);
  headers.set("content-type", "application/json");
  headers.set("x-donkey-client-id", DONKEY_CLIENT_ID);
  return new NextRequest(new URL(path, "http://internal.local"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function extFor(mime: string | undefined, kind: "image" | "video"): string {
  if (mime && EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  return kind === "video" ? "mp4" : "png";
}

async function outputBytes(out: GenerationOutput): Promise<Buffer> {
  if (out.dataBase64) return Buffer.from(out.dataBase64, "base64");
  if (out.url) {
    const res = await fetch(out.url);
    if (!res.ok) throw new Error("Could not download the generated media.");
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("The provider returned no media.");
}

const providerErrorMessage = (error: unknown): string => {
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Generation failed.";
};

/** Lands a settled (completed or failed) generation: uploads the output to
 * R2 for a success, records the failure message otherwise. Shared by submit
 * (a synchronous image) and refresh (an async video that just finished). */
async function land(
  generationId: string,
  userId: string,
  flowId: string,
  kind: "image" | "video",
  gen: AssetGenerationResult,
) {
  if (gen.status === "failed") {
    await prisma.flowGeneration.update({
      where: { id: generationId },
      data: { status: "failed", errorMessage: providerErrorMessage(gen.error) },
    });
    return;
  }
  const out = gen.outputs.find((o) => o.dataBase64) ?? gen.outputs.find((o) => o.url);
  if (!out) {
    await prisma.flowGeneration.update({
      where: { id: generationId },
      data: { status: "failed", errorMessage: "The provider returned no media." },
    });
    return;
  }
  const bytes = await outputBytes(out);
  const mime = out.contentType ?? (kind === "video" ? "video/mp4" : "image/png");
  const key = flowMediaKey(userId, flowId, `${generationId}.${extFor(mime, kind)}`);
  await putObject(key, bytes, mime);
  await prisma.flowGeneration.update({
    where: { id: generationId },
    data: { status: "completed", outputKey: key, outputMime: mime },
  });
  await maybeSetAutoCover(flowId, key);
}

export type SubmitFlowGenerationInput = {
  flowId: string;
  userId: string;
  kind: "image" | "video";
  prompt: string;
  /** Optional — image generation resolves its provider from the model id
   * alone, same as the standalone Text to Image page's own request. */
  provider?: string;
  model: string;
  tier: string;
  refMode?: string;
  inputs?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  /** One stable key per intended generation, minted client-side once and
   * carried through every retry of the SAME HTTP request (never regenerated
   * by a network-level retry). A deliberate new attempt — the user's own
   * "Retry" on a failed row — mints a fresh key, because that really is a
   * new billed call. Optional only for the duplicate-flow path, which
   * writes rows directly and never submits through here. */
  idempotencyKey?: string;
};

/** Creates the row and makes the real (billed) provider call. Returns the
 * row's id and whether it settled immediately or is still rendering.
 *
 * Idempotency: when `idempotencyKey` is given, a row is RESERVED for it
 * before the billed provider call runs, using the column's unique index as
 * the actual guard (a check-then-call race between two requests for the
 * same key is still closed, since only one insert can win). A caller that
 * retries the identical submission — the client never saw the first
 * response, a proxy replays the POST — hits the reservation (or, if it
 * raced the very first insert, the unique-constraint error) and gets the
 * original row back instead of a second billed generation. */
export async function submitFlowGeneration(
  originalHeaders: Headers,
  input: SubmitFlowGenerationInput,
): Promise<{ id: string; status: "in_progress" | "completed" | "failed" }> {
  const findByKey = (key: string) =>
    prisma.flowGeneration.findUnique({ where: { idempotencyKey: key }, select: { id: true, status: true } });

  let reserved: { id: string } | null = null;
  if (input.idempotencyKey) {
    const existing = await findByKey(input.idempotencyKey);
    if (existing) return { id: existing.id, status: existing.status as "in_progress" | "completed" | "failed" };
    try {
      reserved = await prisma.flowGeneration.create({
        data: {
          flowId: input.flowId,
          userId: input.userId,
          kind: input.kind,
          prompt: input.prompt,
          // Not yet known for image (the client sends no provider hint) —
          // overwritten below once the gateway resolves it. A transient
          // empty string satisfies the column's NOT NULL, never read before
          // that update lands since the row is "in_progress" throughout.
          provider: input.provider ?? "",
          model: input.model,
          status: "in_progress",
          idempotencyKey: input.idempotencyKey,
          ...(input.refMode ? { refMode: input.refMode } : {}),
          parameters: (input.parameters ?? {}) as never,
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await findByKey(input.idempotencyKey);
        if (existing) return { id: existing.id, status: existing.status as "in_progress" | "completed" | "failed" };
      }
      throw error;
    }
  }

  const req = innerRequest(originalHeaders, "/api/inference/assets", {
    kind: input.kind,
    prompt: input.prompt,
    ...(input.provider ? { provider: input.provider } : {}),
    model: input.model,
    ...(input.inputs ? { inputs: input.inputs } : {}),
    parameters: input.parameters ?? {},
  });
  const res = await submitAsset(req);
  const gen = (await res.json()) as AssetGenerationResult & { message?: string; error?: string };
  if (!res.ok) {
    const message = gen.message ?? gen.error ?? "Generation failed.";
    if (reserved) {
      await prisma.flowGeneration.update({ where: { id: reserved.id }, data: { status: "failed", errorMessage: message } });
      return { id: reserved.id, status: "failed" };
    }
    throw new Error(message);
  }

  const settledData = {
    provider: gen.provider,
    model: gen.model,
    ...(gen.status === "in_progress"
      ? {
          providerJobId: gen.providerJobId,
          providerGenerationId: gen.providerGenerationId,
          providerPollingUrl: gen.providerPollingUrl,
          providerPayload: (gen.metadata ?? {}) as never,
        }
      : {}),
  };
  const row = reserved
    ? await prisma.flowGeneration.update({ where: { id: reserved.id }, data: settledData, select: { id: true } })
    : await prisma.flowGeneration.create({
        data: {
          flowId: input.flowId,
          userId: input.userId,
          kind: input.kind,
          prompt: input.prompt,
          status: "in_progress",
          ...(input.refMode ? { refMode: input.refMode } : {}),
          parameters: (input.parameters ?? {}) as never,
          ...settledData,
        },
        select: { id: true },
      });

  if (gen.status === "in_progress") {
    return { id: row.id, status: "in_progress" };
  }

  await land(row.id, input.userId, input.flowId, input.kind, gen);
  const settled = await prisma.flowGeneration.findUnique({ where: { id: row.id }, select: { status: true } });
  return { id: row.id, status: (settled?.status as "completed" | "failed") ?? "failed" };
}

/** Polls an in-progress generation one step. A no-op (returns its current
 * status) if the row already settled — callers poll on a timer and a race
 * between two polls should not double-land the same row. */
export async function refreshFlowGeneration(
  originalHeaders: Headers,
  flowId: string,
  generationId: string,
  userId: string,
): Promise<{ status: "in_progress" | "completed" | "failed" }> {
  // Scoped by flowId AND userId — the route already checked the caller owns
  // flowId, but a generation id from a *different* flow (even one the same
  // caller owns) must not be reachable through this URL.
  const row = await prisma.flowGeneration.findFirst({ where: { id: generationId, flowId } });
  if (!row || row.userId !== userId) throw new Error("Generation not found.");
  if (row.status !== "in_progress") return { status: row.status as "completed" | "failed" };

  const req = innerRequest(originalHeaders, "/api/inference/assets/refresh", {
    id: row.id,
    kind: row.kind,
    provider: row.provider,
    model: row.model,
    providerJobId: row.providerJobId,
    providerGenerationId: row.providerGenerationId,
    providerPollingUrl: row.providerPollingUrl,
    metadata: row.providerPayload ?? {},
  });
  const res = await refreshAsset(req);
  const gen = (await res.json()) as AssetGenerationResult & { message?: string; error?: string };
  if (!res.ok) {
    await prisma.flowGeneration.update({
      where: { id: row.id },
      data: { status: "failed", errorMessage: gen.message ?? gen.error ?? "Generation failed." },
    });
    return { status: "failed" };
  }
  if (gen.status === "in_progress") return { status: "in_progress" };

  await land(row.id, userId, row.flowId, row.kind as "image" | "video", gen);
  const settled = await prisma.flowGeneration.findUnique({ where: { id: row.id }, select: { status: true } });
  return { status: (settled?.status as "completed" | "failed") ?? "failed" };
}
