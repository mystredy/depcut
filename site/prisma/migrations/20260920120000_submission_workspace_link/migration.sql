-- CreateTable
CREATE TABLE "submission_workspace_link" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "workspaceName" TEXT NOT NULL,
    "editorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_workspace_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_workspace_link_submissionId_provider_key" ON "submission_workspace_link"("submissionId", "provider");

-- CreateIndex
CREATE INDEX "submission_workspace_link_submissionId_idx" ON "submission_workspace_link"("submissionId");

-- AddForeignKey
ALTER TABLE "submission_workspace_link" ADD CONSTRAINT "submission_workspace_link_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
