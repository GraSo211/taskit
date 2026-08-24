import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  aggregateProgress,
  calculateProgress,
  getUtcDayWindow,
  getUtcWeekWindow,
  isTaskScheduledOnDate,
  startOfUtcDay,
} from "@/lib/task-logic";

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
  const day = startOfUtcDay(date);
  const dayWindow = getUtcDayWindow(day);
  const weekWindow = getUtcWeekWindow(day);

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      isActive: true,
      startDate: { lt: dayWindow.end },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      completions: {
        where: {
          date: { gte: weekWindow.start, lt: weekWindow.end },
        },
        orderBy: { date: "asc" },
      },
    },
  });

  const dashboardTasks = tasks.filter((task) => isTaskScheduledOnDate(task, day)).map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    frequency: task.frequency,
    targetCount: task.targetCount,
    scheduledWeekdays: task.scheduledWeekdays,
    reminderTime: task.reminderTime,
    timezone: task.timezone,
    startDate: task.startDate.toISOString(),
    progress: calculateProgress(
      task,
      task.completions.map((completion) => completion.date),
      day,
    ),
    completedToday: task.completions.some(
      (completion) => completion.date.getTime() === day.getTime(),
    ),
  }));

  return {
    user,
    date: day.toISOString(),
    progress: {
      daily: aggregateProgress(dashboardTasks.map((task) => task.progress.daily)),
      weekly: aggregateProgress(dashboardTasks.map((task) => task.progress.weekly)),
    },
    tasks: dashboardTasks,
  };
}

export async function getOwnedTask(taskId: string, userId: string) {
  return prisma.task.findFirst({ where: { id: taskId, userId } });
}
