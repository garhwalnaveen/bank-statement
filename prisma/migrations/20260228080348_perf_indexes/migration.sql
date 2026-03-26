-- DropIndex
DROP INDEX "Statement_teamId_idx";

-- CreateIndex
CREATE INDEX "Statement_teamId_uploadedAt_idx" ON "Statement"("teamId", "uploadedAt" DESC);
