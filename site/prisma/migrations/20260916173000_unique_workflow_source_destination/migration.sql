-- CreateIndex
CREATE UNIQUE INDEX "social_workflow_sourceConnectionId_destinationConnectionId_key" ON "social_workflow"("sourceConnectionId", "destinationConnectionId");
