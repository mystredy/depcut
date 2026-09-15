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
