CREATE TABLE "WeeklyTaskProgress" (
    "taskId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "achievedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyTaskProgress_pkey" PRIMARY KEY ("taskId", "weekStart"),
    CONSTRAINT "WeeklyTaskProgress_achievedCount_check" CHECK ("achievedCount" >= 0),
    CONSTRAINT "WeeklyTaskProgress_weekStart_monday_check" CHECK (EXTRACT(ISODOW FROM "weekStart") = 1)
);

CREATE INDEX "WeeklyTaskProgress_taskId_weekStart_idx"
ON "WeeklyTaskProgress"("taskId", "weekStart");

ALTER TABLE "WeeklyTaskProgress"
ADD CONSTRAINT "WeeklyTaskProgress_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WeeklyTaskProgress" ("taskId", "weekStart", "achievedCount")
SELECT
    completion."taskId",
    date_trunc('week', completion."date")::date,
    COUNT(*)::integer
FROM "TaskCompletion" AS completion
JOIN "Task" AS task ON task."id" = completion."taskId"
WHERE task."type"::text = 'ROUTINE'
  AND task."frequency"::text = 'WEEKLY'
GROUP BY completion."taskId", date_trunc('week', completion."date")::date;

DELETE FROM "TaskCompletion" AS completion
USING "Task" AS task
WHERE task."id" = completion."taskId"
  AND task."type"::text = 'ROUTINE'
  AND task."frequency"::text = 'WEEKLY';
