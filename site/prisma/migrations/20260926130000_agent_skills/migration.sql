-- CreateEnum
CREATE TYPE "AgentSkillAgent" AS ENUM ('cut', 'blog');

-- CreateTable
CREATE TABLE "AgentSkill" (
    "id" TEXT NOT NULL,
    "agent" "AgentSkillAgent" NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentSkill_agent_idx" ON "AgentSkill"("agent");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkill_agent_name_key" ON "AgentSkill"("agent", "name");
