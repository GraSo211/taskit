-- Events are a third task kind and keep their day outcomes separate from routine completions.
ALTER TYPE "TaskType" ADD VALUE 'EVENT';

CREATE TYPE "EventMode" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TYPE "EventFailurePolicy" AS ENUM ('STOP', 'CONTINUE');
CREATE TYPE "EventDayOutcome" AS ENUM ('COMPLETED', 'FAILED');

ALTER TABLE "Task"
ADD COLUMN "eventMode" "EventMode",
ADD COLUMN "eventDuration" INTEGER,
ADD COLUMN "eventFailurePolicy" "EventFailurePolicy";

ALTER TABLE "Task"
ADD CONSTRAINT "Task_eventDuration_range_check"
CHECK ("eventDuration" IS NULL OR ("eventDuration" >= 1 AND "eventDuration" <= 366));

ALTER TABLE "Task"
ADD CONSTRAINT "Task_event_fields_consistency_check"
CHECK (
    (
        "type"::text = 'EVENT'
        AND "frequency" IS NULL
        AND cardinality("scheduledWeekdays") = 0
        AND "eventDuration" IS NOT NULL
        AND "eventMode" IS NOT NULL
        AND "eventFailurePolicy" IS NOT NULL
    )
    OR (
        "type"::text <> 'EVENT'
        AND "eventDuration" IS NULL
        AND "eventMode" IS NULL
        AND "eventFailurePolicy" IS NULL
    )
);

CREATE TABLE "EventDayMark" (
    "taskId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "outcome" "EventDayOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDayMark_pkey" PRIMARY KEY ("taskId", "date")
);

CREATE INDEX "EventDayMark_taskId_date_idx" ON "EventDayMark"("taskId", "date");

ALTER TABLE "EventDayMark"
ADD CONSTRAINT "EventDayMark_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
