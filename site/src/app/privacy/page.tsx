import ReactMarkdown from "react-markdown";

import { LegalPageShell } from "@/app/legal/LegalPageShell";
import { getLegalPage } from "@/lib/pages/legal-pages";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const page = await getLegalPage("privacy");
  return (
    <LegalPageShell>
      <ReactMarkdown>{page.contentMarkdown}</ReactMarkdown>
    </LegalPageShell>
  );
}
