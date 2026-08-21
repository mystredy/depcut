-- AlterTable
ALTER TABLE "app_settings" ALTER COLUMN "appName" SET DEFAULT 'Depcut';

-- AlterTable
ALTER TABLE "submission" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "telegram_notification_settings" DROP COLUMN "chatId";

-- CreateTable
CREATE TABLE "telegram_command" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "replyText" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_command_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_user" (
    "chatId" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_user_pkey" PRIMARY KEY ("chatId")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_command_trigger_key" ON "telegram_command"("trigger");

-- CreateIndex
CREATE INDEX "submission_projectId_idx" ON "submission"("projectId");

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CutProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
