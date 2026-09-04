import { NextResponse } from "next/server";
import { z } from "zod";

import {
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import {
  isMarketingUnsubscribed,
  setMarketingUnsubscribed,
} from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

export const GET = withDepCutAuth(
  async (request: DepCutAuthenticatedRequest) => {
    return NextResponse.json({
      marketingEmails: !(await isMarketingUnsubscribed(request.depcut.userId)),
    });
  },
);

const updateSchema = z.object({ marketingEmails: z.boolean() });

export const PUT = withDepCutAuth(
  async (request: DepCutAuthenticatedRequest) => {
    const parsed = updateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    await setMarketingUnsubscribed(
      request.depcut.userId,
      !parsed.data.marketingEmails,
    );
    return NextResponse.json({ marketingEmails: parsed.data.marketingEmails });
  },
);
