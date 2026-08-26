import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  aggregateProgress,
  calculateProgress,
  isTaskScheduledOnDate,
} from "@/lib/task-logic";
import {
  dateKeyToDbDate,
  dbDateToDateKey,
  getMondayWeekWindow,
  localDateKey,
  normalizeTimezone,
  type DateKey,
} from "@/lib/task-time";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

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

export async function getDashboardData(date = new Date()) {
  const user = await requireCurrentUser();

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const clockSnapshots = tasks.map((task) => {
    const timezone = normalizeTimezone(task.timezone);
    return { timezone, dateKey: localDateKey(date, timezone) };
  });
  const eligibleTasks = tasks.flatMap((task) => {
    const timezone = normalizeTimezone(task.timezone);
    const todayKey = localDateKey(date, timezone);
    const startDateKey = dbDateToDateKey(task.startDate);
    return startDateKey <= todayKey ? [{ task, timezone, todayKey }] : [];
  });

  const weekWindows = eligibleTasks.map(({ todayKey }) => getMondayWeekWindow(todayKey));
  const completions = weekWindows.length
    ? await prisma.taskCompletion.findMany({
        where: {
          taskId: { in: eligibleTasks.map(({ task }) => task.id) },
          date: {
            gte: dateKeyToDbDate(
              weekWindows.reduce(
                (minimum, week) => (week.start < minimum ? week.start : minimum),
                weekWindows[0].start,
              ),
            ),
            lt: dateKeyToDbDate(
              weekWindows.reduce(
                (maximum, week) => (week.end > maximum ? week.end : maximum),
                weekWindows[0].end,
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

  const taskData = eligibleTasks.map(({ task, timezone, todayKey }) => {
    const completionDates = completionsByTask.get(task.id) ?? [];
    const progress = calculateProgress(task, completionDates, todayKey);
    return {
      id: task.id,
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
      completedToday: completionDates.includes(todayKey),
    };
  });
  const dashboardTasks = taskData.filter((task) =>
    isTaskScheduledOnDate(task, task.todayKey),
  );

  return {
    user,
    clockSnapshots,
    progress: {
      daily: aggregateProgress(dashboardTasks.map((task) => task.progress.daily)),
      weekly: aggregateProgress(taskData.map((task) => task.progress.weekly)),
    },
    tasks: dashboardTasks,
  };
}

export async function getOwnedTask(taskId: string, userId: string) {
  return prisma.task.findFirst({ where: { id: taskId, userId } });
}
