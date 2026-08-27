-- Existing rows remain routines; PROJECT rows have no routine frequency.
CREATE TYPE "TaskType" AS ENUM ('ROUTINE', 'PROJECT');

ALTER TABLE "Task"
ADD COLUMN "type" "TaskType" NOT NULL DEFAULT 'ROUTINE',
ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Task"
ALTER COLUMN "frequency" DROP NOT NULL,
ALTER COLUMN "targetCount" SET DEFAULT 1;

CREATE TABLE "TaskSubtask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSubtask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskSubtask_taskId_position_key" ON "TaskSubtask"("taskId", "position");
CREATE INDEX "TaskSubtask_taskId_position_idx" ON "TaskSubtask"("taskId", "position");

ALTER TABLE "TaskSubtask"
ADD CONSTRAINT "TaskSubtask_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
