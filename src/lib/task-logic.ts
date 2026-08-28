export type TaskFrequency = "DAILY" | "WEEKLY";
export type TaskType = "ROUTINE" | "PROJECT";

export type TaskForProgress = {
  frequency: TaskFrequency;
  targetCount: number;
  scheduledWeekdays?: readonly number[];
  startDate?: string | Date;
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

export type ProjectSubtaskForProgress = {
  id?: string;
  parentId?: string | null;
  completed: boolean;
  children?: readonly ProjectSubtaskForProgress[];
};

const UTC_DAY_MS = 24 * 60 * 60 * 1000;

import {
  addDays,
  dbDateToDateKey,
  getMondayWeekWindow,
  type DateKey,
  weekdayOfDateKey,
} from "./task-time";

type DateLike = DateKey | Date;

function toDateKey(value: DateLike): DateKey {
  return typeof value === "string" ? value : dbDateToDateKey(value);
}

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

export function getTaskWindow(frequency: TaskFrequency, date: Date): { start: Date; end: Date };
export function getTaskWindow(frequency: TaskFrequency, date: DateKey): { start: DateKey; end: DateKey };
export function getTaskWindow(
  frequency: TaskFrequency,
  date: DateLike,
): { start: Date | DateKey; end: Date | DateKey } {
  if (typeof date === "string") {
    return frequency === "DAILY"
      ? { start: date, end: addDays(date, 1) }
      : getMondayWeekWindow(date);
  }
  return frequency === "DAILY" ? getUtcDayWindow(date) : getUtcWeekWindow(date);
}

export function isTaskScheduledOnDate(task: TaskForProgress, date: DateLike): boolean {
  const day = toDateKey(date);
  if (task.startDate && day < toDateKey(task.startDate)) return false;
  if (task.frequency === "WEEKLY") return true;

  const scheduledWeekdays = task.scheduledWeekdays ?? [];
  return scheduledWeekdays.length === 0 || scheduledWeekdays.includes(weekdayOfDateKey(day));
}

export function countScheduledDaysInWeek(task: TaskForProgress, date: DateLike): number {
  const { start } = getMondayWeekWindow(toDateKey(date));
  return Array.from({ length: 7 }, (_, index) => {
    return isTaskScheduledOnDate(task, addDays(start, index)) ? 1 : 0;
  }).reduce<number>((total, value) => total + value, 0);
}

function countDatesInWindow(dates: readonly DateKey[], window: { start: DateKey; end: DateKey }) {
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

export function calculateProjectProgress(subtasks: readonly ProjectSubtaskForProgress[]): Progress {
  const nested = subtasks.some((subtask) => subtask.children !== undefined);
  const leaves = nested
    ? collectTreeLeaves(subtasks)
    : (() => {
        const parentIds = new Set(
          subtasks.flatMap((subtask) => (subtask.id && subtask.parentId ? [subtask.parentId] : [])),
        );
        return subtasks.filter((subtask) => !subtask.id || !parentIds.has(subtask.id));
      })();
  const completed = leaves.filter((subtask) => subtask.completed).length;
  const target = leaves.length;
  return {
    completed,
    target,
    percentage: target === 0 ? 0 : Math.min(100, Math.round((completed / target) * 100)),
    isComplete: target > 0 && completed === target,
  };
}

export function isProjectComplete(subtasks: readonly ProjectSubtaskForProgress[]): boolean {
  const roots = subtasks.filter((subtask) => subtask.parentId === undefined || subtask.parentId === null);
  return roots.length > 0 && roots.every((subtask) => subtask.completed);
}

function collectTreeLeaves(
  subtasks: readonly ProjectSubtaskForProgress[],
): ProjectSubtaskForProgress[] {
  const leaves: ProjectSubtaskForProgress[] = [];
  const pending = [...subtasks];
  while (pending.length) {
    const subtask = pending.pop();
    if (!subtask) continue;
    if (subtask.children?.length) pending.push(...subtask.children);
    else leaves.push(subtask);
  }
  return leaves;
}

export function calculateProgress(
  task: TaskForProgress,
  completionDates: readonly DateLike[],
  date: DateLike,
): TaskProgress {
  const todayKey = toDateKey(date);
  const scheduledCompletions = completionDates
    .filter((completionDate) => isTaskScheduledOnDate(task, completionDate))
    .map(toDateKey);
  const dailyCount = countDatesInWindow(scheduledCompletions, {
    start: todayKey,
    end: addDays(todayKey, 1),
  });
  const weeklyCount = countDatesInWindow(scheduledCompletions, getMondayWeekWindow(todayKey));

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
