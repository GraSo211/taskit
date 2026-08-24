-- Add an empty schedule by default so existing DAILY tasks remain active every day.
ALTER TABLE "Task"
ADD COLUMN "scheduledWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
