-- Track how many times a daily routine was completed on a given date.
ALTER TABLE "TaskCompletion"
ADD COLUMN "count" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "TaskCompletion"
ADD CONSTRAINT "TaskCompletion_count_check" CHECK ("count" >= 0);
