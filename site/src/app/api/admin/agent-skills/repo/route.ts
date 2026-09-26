import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { listRepoDir, readRepoFile, RepoReadError } from "@/lib/githubRepoRead";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  action: z.enum(["list", "read"]),
  path: z.string().max(500).default(""),
});

// Super-user only — the Skill Builder's read_repo_file/list_repo_dir tools
// (see .../builder-chat's tool declarations) call this to read the site's
// own source. GitHub Contents API, not local disk — see githubRepoRead.ts.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    if (parsed.data.action === "list") {
      const entries = await listRepoDir(parsed.data.path);
      return NextResponse.json({ entries });
    }
    const content = await readRepoFile(parsed.data.path);
    return NextResponse.json({ content, path: parsed.data.path });
  } catch (error) {
    const message = error instanceof RepoReadError ? error.message : "Could not read the repo.";
    return NextResponse.json({ error: message }, { status: error instanceof RepoReadError ? 400 : 502 });
  }
});
