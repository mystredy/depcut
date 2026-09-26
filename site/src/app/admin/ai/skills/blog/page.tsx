"use client";

import { AgentSkillsList } from "../AgentSkillsList";

export default function AdminBlogAgentSkillsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Blog Agent Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Playbooks for the blog post editor&apos;s AI chat — list_skills/read_skill in its tool
          list. There are no built-in blog skills; everything here is admin-authored.
        </p>
      </div>
      <AgentSkillsList agent="blog" />
    </div>
  );
}
