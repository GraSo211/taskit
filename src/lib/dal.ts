import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  aggregateProgress,
  calculateProgress,
  calculateProjectProgress,
  isTaskScheduledOnDate,
  type TaskFrequency,
} from "@/lib/task-logic";
import { projectEvent, type EventDayOutcome, type EventDayStatus } from "@/lib/event-logic";
import { projectSubtaskTree, type SubtaskRow, type SubtaskTreeNode } from "@/lib/subtask-logic";
import {
  addDays,
  dateKeyToDbDate,
  dbDateToDateKey,
  getMondayWeekWindow,
  localDateKey,
  normalizeTimezone,
  isValidDateKey,
  type DateKey,
} from "@/lib/task-time";
import { isAllowedApplicationEmail } from "@/lib/allowlist";

export { ALLOWED_APPLICATION_EMAIL, isAllowedApplicationEmail } from "@/lib/allowlist";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isAllowedApplicationEmail(session.user.email)) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export type DashboardHistory = {
  daily?: {
    startDate: string;
    endDate: string;
    points: Array<{ dateKey: string; completed: boolean; scheduled: boolean }>;
  };
  weekly?: {
    weekStart: string;
    weekEnd: string;
    completed: number;
    target: number;
    days: Array<{ dateKey: string; completed: boolean }>;
  };
};

export type DashboardProject = {
  id: string;
  title: string;
  description: string | null;
  type: "PROJECT";
  frequency: null;
  startDate: string;
  completed: boolean;
  subtasks: SubtaskTreeNode[];
  progress: ReturnType<typeof calculateProjectProgress>;
};

export type DashboardEvent = {
  id: string;
  title: string;
  description: string | null;
  type: "EVENT";
  mode: "MANUAL" | "AUTOMATIC";
  duration: number;
  failurePolicy: "STOP" | "CONTINUE";
  timezone: string;
  startDate: string;
  todayKey: string;
  days: Array<{
    dateKey: string;
    status: EventDayStatus;
    outcome: EventDayOutcome | null;
  }>;
};

const DAILY_HISTORY_LENGTH = 84;

function isRoutineRecord<T extends { type: string; frequency: TaskFrequency | null }>(
  task: T,
): task is T & { frequency: TaskFrequency } {
  return task.type !== "PROJECT" && task.frequency !== null;
}

function latestDateKey(...dateKeys: DateKey[]) {
  return dateKeys.reduce((latest, dateKey) => (dateKey > latest ? dateKey : latest));
}

function getTaskHistory(
  task: Parameters<typeof calculateProgress>[0] & { frequency: "DAILY" | "WEEKLY" },
  todayKey: DateKey,
  completionDates: readonly DateKey[],
  weeklyProgress: { completed: number; target: number },
): DashboardHistory {
  const completionSet = new Set(completionDates);

  if (task.frequency === "DAILY") {
    const startDateKey = task.startDate
      ? typeof task.startDate === "string"
        ? task.startDate
        : dbDateToDateKey(task.startDate)
      : todayKey;
    const startDate = latestDateKey(addDays(todayKey, -(DAILY_HISTORY_LENGTH - 1)), startDateKey);
    const points = [];

    for (let dateKey = startDate; dateKey <= todayKey; dateKey = addDays(dateKey, 1)) {
      points.push({
        dateKey,
        completed: completionSet.has(dateKey),
        scheduled: isTaskScheduledOnDate(task, dateKey),
      });
    }

    return { daily: { startDate, endDate: todayKey, points } };
  }

  const week = getMondayWeekWindow(todayKey);
  const days = Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDays(week.start, index);
    return {
      dateKey,
      completed: completionSet.has(dateKey) && isTaskScheduledOnDate(task, dateKey),
    };
  });

  return {
    weekly: {
      weekStart: week.start,
      weekEnd: addDays(week.start, 6),
      completed: weeklyProgress.completed,
      target: weeklyProgress.target,
      days,
    },
  };
}

export async function getDashboardData(date = new Date(), requestedSelectedDateKey?: string) {
  const user = await requireCurrentUser();

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      subtasks: { orderBy: { position: "asc" } },
      eventDayMarks: { orderBy: { date: "asc" } },
    },
  });

  const clockSnapshots = tasks.map((task) => {
    const timezone = normalizeTimezone(task.timezone);
    return { timezone, dateKey: localDateKey(date, timezone) };
  });
  const routineTasks = tasks.filter(isRoutineRecord);
  const projectTasks = tasks.filter((task) => task.type === "PROJECT");
  const eventTasks = tasks.filter((task) => task.type === "EVENT");
  const eligibleTasks = routineTasks.flatMap((task) => {
    const timezone = normalizeTimezone(task.timezone);
    const todayKey = localDateKey(date, timezone);
    const startDateKey = dbDateToDateKey(task.startDate);
    return startDateKey <= todayKey ? [{ task, timezone, todayKey, startDateKey }] : [];
  });

  const selectedDateKey = isValidDateKey(requestedSelectedDateKey)
    ? requestedSelectedDateKey
    : undefined;
  const eligibleSelectedDateTasks = eligibleTasks.filter(({ startDateKey, todayKey }) => {
    const taskSelectedDateKey = selectedDateKey ?? todayKey;
    return startDateKey <= taskSelectedDateKey;
  });
  const completionWindows = eligibleSelectedDateTasks.map(({ task, todayKey, startDateKey }) => {
    const taskSelectedDateKey = selectedDateKey ?? todayKey;
    const week = getMondayWeekWindow(taskSelectedDateKey);
    const dailyHistoryStart = latestDateKey(
      addDays(taskSelectedDateKey, -(DAILY_HISTORY_LENGTH - 1)),
      startDateKey,
    );
    return {
      start: task.frequency === "DAILY"
        ? dailyHistoryStart
        : latestDateKey(week.start, startDateKey),
      end: task.frequency === "DAILY" ? addDays(taskSelectedDateKey, 1) : week.end,
    };
  });
  const completions = completionWindows.length
    ? await prisma.taskCompletion.findMany({
        where: {
          taskId: { in: eligibleSelectedDateTasks.map(({ task }) => task.id) },
          date: {
            gte: dateKeyToDbDate(
              completionWindows.reduce(
                (minimum, window) => (window.start < minimum ? window.start : minimum),
                completionWindows[0].start,
              ),
            ),
            lt: dateKeyToDbDate(
              completionWindows.reduce(
                (maximum, window) => (window.end > maximum ? window.end : maximum),
                completionWindows[0].end,
              ),
            ),
          },
        },
        orderBy: { date: "asc" },
      })
    : [];
  const completionsByTask = new Map<string, DateKey[]>();
  for (const completion of completions) {
    const dates = completionsByTask.get(completion.taskId) ?? [];
    dates.push(dbDateToDateKey(completion.date));
    completionsByTask.set(completion.taskId, dates);
  }

  const taskData = eligibleSelectedDateTasks.map(({ task, timezone, todayKey }) => {
    const completionDates = completionsByTask.get(task.id) ?? [];
    const taskSelectedDateKey = selectedDateKey ?? todayKey;
    const progress = calculateProgress(task, completionDates, taskSelectedDateKey);
    return {
      id: task.id,
      type: "ROUTINE" as const,
      title: task.title,
      description: task.description,
      frequency: task.frequency,
      targetCount: task.targetCount,
      scheduledWeekdays: task.scheduledWeekdays,
      reminderTime: task.reminderTime,
      timezone,
      todayKey,
      startDate: dbDateToDateKey(task.startDate),
      progress,
      history: getTaskHistory(task, taskSelectedDateKey, completionDates, progress.weekly),
      completedToday: completionDates.includes(todayKey),
      selectedDateKey: taskSelectedDateKey,
      completedOnSelectedDate: completionDates.includes(taskSelectedDateKey),
      canCompleteSelectedDate: taskSelectedDateKey <= todayKey,
    };
  });
  const dashboardTasks = taskData.filter((task) =>
    isTaskScheduledOnDate(task, task.selectedDateKey),
  );
  const projects: DashboardProject[] = projectTasks.flatMap((task) => {
    const timezone = normalizeTimezone(task.timezone);
    const todayKey = localDateKey(date, timezone);
    if (dbDateToDateKey(task.startDate) > todayKey) return [];

    const subtasks = projectSubtaskTree((task.subtasks ?? []) as SubtaskRow[]);
    const progress = calculateProjectProgress(subtasks);
    return [
      {
        id: task.id,
        title: task.title,
        description: task.description,
        type: "PROJECT" as const,
        frequency: null,
        startDate: dbDateToDateKey(task.startDate),
        completed: progress.isComplete,
        subtasks,
        progress,
      },
    ];
  });
  const events: DashboardEvent[] = eventTasks.flatMap((task) => {
    if (!task.eventMode || !task.eventDuration || !task.eventFailurePolicy) return [];
    const timezone = normalizeTimezone(task.timezone);
    const todayKey = localDateKey(date, timezone);
    const projection = projectEvent(
      {
        startDate: dbDateToDateKey(task.startDate),
        duration: task.eventDuration,
        timezone,
        mode: task.eventMode,
        failurePolicy: task.eventFailurePolicy,
      },
      (task.eventDayMarks ?? []).map((mark) => ({ dateKey: mark.date, outcome: mark.outcome })),
      date,
    );
    return [{
      id: task.id,
      title: task.title,
      description: task.description,
      type: "EVENT" as const,
      mode: task.eventMode,
      duration: task.eventDuration,
      failurePolicy: task.eventFailurePolicy,
      timezone,
      startDate: dbDateToDateKey(task.startDate),
      todayKey,
      days: projection.days,
    }];
  });

  return {
    user,
    clockSnapshots,
    progress: {
      daily: aggregateProgress(
        dashboardTasks
          .filter((task) => task.frequency === "DAILY")
          .map((task) => task.progress.daily),
      ),
      weekly: aggregateProgress(
        taskData
          .filter((task) => task.frequency === "WEEKLY")
          .map((task) => task.progress.weekly),
      ),
    },
    tasks: dashboardTasks,
    projects,
    events,
  };
}

export async function getOwnedTask(taskId: string, userId: string) {
  return prisma.task.findFirst({ where: { id: taskId, userId } });
}

export async function getOwnedProjectTask(taskId: string, userId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, userId, type: "PROJECT" },
    include: { subtasks: { orderBy: { position: "asc" } } },
  });
}

export async function getOwnedEvent(taskId: string, userId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, userId, type: "EVENT" },
    include: { eventDayMarks: { orderBy: { date: "asc" } } },
  });
}

export async function getOwnedSubtask(subtaskId: string, taskId: string, userId: string) {
  return prisma.taskSubtask.findFirst({
    where: { id: subtaskId, taskId, task: { userId, type: "PROJECT" } },
  });
}
