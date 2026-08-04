import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";

export const LEGAL_PAGE_SLUGS = ["privacy", "terms"] as const;
export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

const SOURCE: Record<LegalPageSlug, { title: string; file: string }> = {
  privacy: { file: "PrivacyPolicy.mdx", title: "Privacy Policy" },
  terms: { file: "TermsOfService.mdx", title: "Terms of Use" },
};

// Seeds a LegalPage row from the original legal/*.mdx source the first time
// it's read, so the admin editor and the public /privacy and /terms routes
// have real starting content instead of an empty page.
async function seedFromSource(slug: LegalPageSlug) {
  const { file, title } = SOURCE[slug];
  const contentMarkdown = await readFile(
    path.join(process.cwd(), "src/app/legal", file),
    "utf8",
  );
  return prisma.legalPage.create({ data: { contentMarkdown, slug, title } });
}

export async function getLegalPage(slug: LegalPageSlug) {
  const existing = await prisma.legalPage.findUnique({ where: { slug } });
  if (existing) return existing;
  return seedFromSource(slug);
}

export async function listLegalPages() {
  for (const slug of LEGAL_PAGE_SLUGS) {
    const existing = await prisma.legalPage.findUnique({ where: { slug } });
    if (!existing) await seedFromSource(slug);
  }
  return prisma.legalPage.findMany({ orderBy: { slug: "asc" } });
}
