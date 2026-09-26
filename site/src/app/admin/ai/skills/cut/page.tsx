"use client";

import { useState } from "react";

import { AgentSkillsList } from "../AgentSkillsList";
import { SkillBuilderPanel } from "./SkillBuilderPanel";

export default function AdminCutAgentSkillsPage() {
  const [draftBody, setDraftBody] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Cut Agent Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Playbooks the Cut editor&apos;s AI agent reads before working in an area it&apos;s
          unsure about (list_skills/read_skill). Built-in skills ship in code
          (cut/server/ai/catalog.ts) and aren&apos;t listed here; a skill added below with the
          same name overrides one of them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AgentSkillsList agent="cut" initialBody={draftBody} />
        <SkillBuilderPanel onUseAsSkill={setDraftBody} />
      </div>
    </div>
  );
}
