import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Seeded with the models actually seen in this app's usage (see the Usage
// admin page) rather than invented names — still purely descriptive, no real
// router reads priority/status yet.
const SEED_ENGINES = [
  {
    fallback: "None (highest priority)",
    latencyNote: "Primary model behind chat/completions and generateText()",
    name: "gemini-3.5-flash",
    priority: 3,
    status: "active",
  },
  {
    fallback: "gemini-3.5-flash",
    latencyNote: "Lighter-weight fallback",
    name: "gemini-3.1-flash-lite",
    priority: 2,
    status: "active",
  },
  {
    fallback: "gemini-3.5-flash",
    latencyNote: "Screenshot / computer-use tasks only",
    name: "gemini-computer-use",
    priority: 1,
    status: "standby",
  },
];

// Super-user only. Self-seeds on first read.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const existing = await prisma.aiEngine.count();
  if (existing === 0) {
    await prisma.aiEngine.createMany({ data: SEED_ENGINES });
  }

  const engines = await prisma.aiEngine.findMany({ orderBy: { priority: "desc" } });

  return NextResponse.json({ engines });
});
