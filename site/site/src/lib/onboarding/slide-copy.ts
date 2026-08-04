import { prisma } from "@/lib/prisma";

import { ONBOARDING_SLIDE_SEED } from "./slide-copy-seed";

export async function listOnboardingSlideCopy() {
  for (const seed of ONBOARDING_SLIDE_SEED) {
    const existing = await prisma.onboardingSlide.findUnique({ where: { slug: seed.slug } });
    if (!existing) await prisma.onboardingSlide.create({ data: seed });
  }
  return prisma.onboardingSlide.findMany({ orderBy: { slug: "asc" } });
}
