-- Existing subtasks remain roots; parentId is nullable so no data is lost.
ALTER TABLE "TaskSubtask"
ADD COLUMN "parentId" TEXT;

ALTER TABLE "TaskSubtask"
ADD CONSTRAINT "TaskSubtask_id_taskId_key" UNIQUE ("id", "taskId");

ALTER TABLE "TaskSubtask"
ADD CONSTRAINT "TaskSubtask_parent_not_self_check"
CHECK ("parentId" IS NULL OR "parentId" <> "id");

ALTER TABLE "TaskSubtask"
ADD CONSTRAINT "TaskSubtask_parent_same_task_fkey"
FOREIGN KEY ("parentId", "taskId") REFERENCES "TaskSubtask"("id", "taskId")
ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "TaskSubtask_taskId_position_key";
DROP INDEX "TaskSubtask_taskId_position_idx";

CREATE INDEX "TaskSubtask_taskId_parentId_position_idx"
ON "TaskSubtask"("taskId", "parentId", "position");

CREATE UNIQUE INDEX "TaskSubtask_root_position_key"
ON "TaskSubtask"("taskId", "position")
WHERE "parentId" IS NULL;

CREATE UNIQUE INDEX "TaskSubtask_child_position_key"
ON "TaskSubtask"("taskId", "parentId", "position")
WHERE "parentId" IS NOT NULL;
