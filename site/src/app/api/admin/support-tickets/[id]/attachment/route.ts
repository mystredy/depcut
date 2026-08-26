import { NextResponse } from "next/server";

import { isDonkeySuperUser, notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Super-user only. The bytes a ticket's create request attached, served the
// same way the avatar route serves its own inline-DB image.
export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const ticket = await prisma.supportTicket.findUnique({
    select: { attachmentContentType: true, attachmentData: true },
    where: { id },
  });
  if (!ticket?.attachmentData || !ticket.attachmentContentType) {
    return notFoundResponse();
  }

  return new NextResponse(new Blob([ticket.attachmentData], { type: ticket.attachmentContentType }), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": ticket.attachmentContentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
});
