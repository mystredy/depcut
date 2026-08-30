import { AI_MODEL_SEED, aiModelKey } from "@/lib/ai-models-seed";
import { prisma } from "@/lib/prisma";

// Shared by the admin list route and the public enabled-models route so the
// two never seed independently. Runs skipDuplicates every read (not gated
// behind a count===0 check) so a model added to the seed list later shows up
// on its own instead of needing a manual DB touch — cheap enough for a
// low-traffic config table.
export async function listAiModels() {
  await prisma.aiModel.createMany({
    data: AI_MODEL_SEED.map((m) => ({
      key: aiModelKey(m.modality, m.tier),
      label: m.label,
      modality: m.modality,
      modelId: m.modelId,
      tier: m.tier,
    })),
    skipDuplicates: true,
  });

  return prisma.aiModel.findMany({ orderBy: [{ modality: "asc" }, { label: "asc" }] });
}
