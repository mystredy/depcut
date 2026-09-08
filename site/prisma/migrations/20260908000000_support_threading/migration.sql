-- CreateTable
CREATE TABLE "support_message" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_message_ticketId_idx" ON "support_message"("ticketId");

-- AddForeignKey
ALTER TABLE "support_message" ADD CONSTRAINT "support_message_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_message" ADD CONSTRAINT "support_message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "support_message_attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_message_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_message_attachment_messageId_idx" ON "support_message_attachment"("messageId");

-- AddForeignKey
ALTER TABLE "support_message_attachment" ADD CONSTRAINT "support_message_attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "support_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "support_ticket" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'Low';
ALTER TABLE "support_ticket" ADD COLUMN "lastReplyAt" TIMESTAMP(3);

-- Data migration: the opening message for every existing ticket
INSERT INTO "support_message" ("id", "ticketId", "authorId", "message", "createdAt")
SELECT 'legacy-open-' || t."id", t."id", t."userId", t."message", t."createdAt"
FROM "support_ticket" t;

-- Data migration: the admin's reply, for every ticket that has one
INSERT INTO "support_message" ("id", "ticketId", "authorId", "message", "createdAt")
SELECT 'legacy-reply-' || t."id", t."id", COALESCE(t."resolvedById", t."userId"), t."response", COALESCE(t."resolvedAt", t."updatedAt")
FROM "support_ticket" t
WHERE t."response" IS NOT NULL;

-- Data migration: every existing attachment moves onto its ticket's opening message
INSERT INTO "support_message_attachment" ("id", "messageId", "data", "contentType", "createdAt")
SELECT a."id", 'legacy-open-' || a."ticketId", a."data", a."contentType", a."createdAt"
FROM "support_ticket_attachment" a;

-- Data migration: fold the old "Resolved" status into "Closed", backfill lastReplyAt
UPDATE "support_ticket" SET "status" = 'Closed' WHERE "status" = 'Resolved';
UPDATE "support_ticket" SET "lastReplyAt" = COALESCE("resolvedAt", "updatedAt") WHERE "response" IS NOT NULL;

-- DropTable: replaced by support_message_attachment
DROP TABLE "support_ticket_attachment";

-- AlterTable: fields now represented in support_message
ALTER TABLE "support_ticket" DROP COLUMN "message";
ALTER TABLE "support_ticket" DROP COLUMN "response";
ALTER TABLE "support_ticket" DROP COLUMN "resolvedById";
ALTER TABLE "support_ticket" DROP COLUMN "resolvedAt";
