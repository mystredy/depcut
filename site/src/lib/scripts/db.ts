import { prisma } from "@/lib/prisma";

type CreateScriptBase = {
  userId: string;
  topic: string;
  duration: string;
  platform: string;
  tone?: string;
};

export type CreateScriptInput =
  | (CreateScriptBase & { status: "succeeded"; script: string })
  | (CreateScriptBase & { status: "failed"; errorMessage: string });

/** Record a finished (succeeded or failed) Scripting run — called once,
 * right after the run settles client-side (see cut/lib/scriptPersist.ts). */
export async function createScriptGeneration(input: CreateScriptInput): Promise<{ id: string }> {
  return prisma.scriptGeneration.create({
    data: {
      duration: input.duration,
      errorMessage: input.status === "failed" ? input.errorMessage : null,
      platform: input.platform,
      script: input.status === "succeeded" ? input.script : null,
      status: input.status,
      tone: input.tone,
      topic: input.topic,
      userId: input.userId,
    },
    select: { id: true },
  });
}

export type ScriptGenerationRow = {
  id: string;
  topic: string;
  duration: string;
  platform: string;
  tone: string | null;
  status: string;
  script: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

const HISTORY_LIMIT = 50;

export async function listScriptGenerations(userId: string): Promise<ScriptGenerationRow[]> {
  return prisma.scriptGeneration.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      duration: true,
      errorMessage: true,
      id: true,
      platform: true,
      script: true,
      status: true,
      tone: true,
      topic: true,
    },
    take: HISTORY_LIMIT,
    where: { userId },
  });
}

export async function deleteScriptGeneration(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.scriptGeneration.deleteMany({ where: { id, userId } });
  return count > 0;
}
