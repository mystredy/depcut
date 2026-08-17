import type { Prisma } from "@/generated/prisma/client";

// Builds a Notification create() input for use inside a $transaction
// alongside the write that triggered it, so the notification never fires
// for a mutation that ends up rolling back.
export function notifyUser(input: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
}): Prisma.NotificationCreateArgs {
  return { data: input };
}
