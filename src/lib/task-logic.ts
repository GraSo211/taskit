export type TaskFrequency = "DAILY" | "WEEKLY";

export type TaskForProgress = {
  frequency: TaskFrequency;
  targetCount: number;
  scheduledWeekdays?: readonly number[];
  startDate?: Date;
};

export type Progress = {
  completed: number;
  target: number;
  percentage: number;
  isComplete: boolean;
};

export type TaskProgress = {
  daily: Progress;
  weekly: Progress;
};

const UTC_DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getUtcDayWindow(date: Date): { start: Date; end: Date } {
  const start = startOfUtcDay(date);
  return { start, end: new Date(start.getTime() + UTC_DAY_MS) };
}

export function getUtcWeekWindow(date: Date): { start: Date; end: Date } {
  const day = startOfUtcDay(date);
  const mondayOffset = (day.getUTCDay() + 6) % 7;
  const start = new Date(day.getTime() - mondayOffset * UTC_DAY_MS);
  return { start, end: new Date(start.getTime() + 7 * UTC_DAY_MS) };
}

export function getTaskWindow(
  frequency: TaskFrequency,
  date: Date,
): { start: Date; end: Date } {
  return frequency === "DAILY" ? getUtcDayWindow(date) : getUtcWeekWindow(date);
}

export function isTaskScheduledOnDate(task: TaskForProgress, date: Date): boolean {
  const day = startOfUtcDay(date);
  if (task.startDate && day < startOfUtcDay(task.startDate)) return false;
  if (task.frequency === "WEEKLY") return true;

  const scheduledWeekdays = task.scheduledWeekdays ?? [];
  return scheduledWeekdays.length === 0 || scheduledWeekdays.includes(day.getUTCDay());
}

export function countScheduledDaysInWeek(task: TaskForProgress, date: Date): number {
  const { start } = getUtcWeekWindow(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start.getTime() + index * UTC_DAY_MS);
    return isTaskScheduledOnDate(task, day) ? 1 : 0;
  }).reduce<number>((total, value) => total + value, 0);
}

function countDatesInWindow(dates: readonly Date[], window: { start: Date; end: Date }) {
  return dates.filter((date) => date >= window.start && date < window.end).length;
}

function makeProgress(completed: number, target: number): Progress {
  const safeTarget = Math.max(1, target);
  return {
    completed,
    target: safeTarget,
    percentage: Math.min(100, Math.round((completed / safeTarget) * 100)),
    isComplete: completed >= safeTarget,
  };
}

export function calculateProgress(
  task: TaskForProgress,
  completionDates: readonly Date[],
  date: Date,
): TaskProgress {
  const scheduledCompletions = completionDates.filter((completionDate) =>
    isTaskScheduledOnDate(task, completionDate),
  );
  const dailyCount = countDatesInWindow(scheduledCompletions, getUtcDayWindow(date));
  const weeklyCount = countDatesInWindow(scheduledCompletions, getUtcWeekWindow(date));

  return {
    daily: makeProgress(dailyCount, task.targetCount),
    weekly: makeProgress(
      weeklyCount,
      task.frequency === "DAILY"
        ? task.targetCount * countScheduledDaysInWeek(task, date)
        : task.targetCount,
    ),
  };
}

export function aggregateProgress(progressItems: readonly Progress[]): Progress {
  const completed = progressItems.reduce((total, progress) => total + progress.completed, 0);
  const target = progressItems.reduce((total, progress) => total + progress.target, 0);
  return makeProgress(completed, target);
}
