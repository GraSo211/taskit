-- Soft delete projects and events: nullable timestamp, never null on active rows.
ALTER TABLE "Task" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_userId_deletedAt_idx" ON "Task"("userId", "deletedAt");
