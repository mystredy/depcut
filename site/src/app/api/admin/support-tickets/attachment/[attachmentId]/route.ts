import { NextResponse } from "next/server";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ attachmentId: string }> };

// Super-user only. One ticket's screenshot, served the same way the avatar
// route serves its own inline-DB image.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const { attachmentId } = await context.params;
  const attachment = await prisma.supportTicketAttachment.findUnique({
    select: { contentType: true, data: true },
    where: { id: attachmentId },
  });
  if (!attachment) return notFoundResponse();

  return new NextResponse(new Blob([attachment.data], { type: attachment.contentType }), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": attachment.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
});
