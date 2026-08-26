"use server";

import { revalidatePath } from "next/cache";

import { getOwnedTask, requireCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { isTaskScheduledOnDate } from "@/lib/task-logic";
import { dateKeyToDbDate, localDateKey } from "@/lib/task-time";
import {
  createTaskSchema,
  normalizeTaskData,
  setTaskCompletionSchema,
  taskIdSchema,
  taskCompletionDateSchema,
  updateTaskSchema,
} from "@/lib/task-validation";

export async function createTask(input: unknown) {
  const user = await requireCurrentUser();
  const data = normalizeTaskData(createTaskSchema.parse(input));

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title: data.title,
      description: data.description || null,
      frequency: data.frequency,
      targetCount: data.targetCount,
      scheduledWeekdays: data.scheduledWeekdays,
      reminderTime: data.reminderTime || null,
      timezone: data.timezone,
      startDate: dateKeyToDbDate(data.startDate),
    },
  });

  revalidatePath("/dashboard");
  return { id: task.id };
}

export async function updateTask(input: unknown, values?: unknown) {
  const payload =
    values === undefined
      ? input
      : { ...(values as Record<string, unknown>), taskId: input };
  const data = normalizeTaskData(updateTaskSchema.parse(payload));
  const user = await requireCurrentUser();
  const task = await getOwnedTask(data.taskId, user.id);
  if (!task) throw new Error("Task not found");

  await prisma.task.update({
    where: { id: task.id },
    data: {
      title: data.title,
      description: data.description || null,
      frequency: data.frequency,
      targetCount: data.targetCount,
      scheduledWeekdays: data.scheduledWeekdays,
      reminderTime: data.reminderTime || null,
      timezone: data.timezone,
      startDate: dateKeyToDbDate(data.startDate),
    },
  });

  revalidatePath("/dashboard");
  return { id: task.id };
}

async function assertOwnedTask(input: unknown) {
  const taskId = taskIdSchema.parse(input);
  const user = await requireCurrentUser();
  const task = await getOwnedTask(taskId, user.id);
  if (!task) throw new Error("Task not found");
  return task;
}

function taskTodayKey(task: { timezone: string }, now = new Date()) {
  return localDateKey(now, task.timezone);
}

async function setTaskCompletionForInput(input: unknown, completed: boolean) {
  const data = setTaskCompletionSchema.parse({
    ...taskCompletionDateSchema.parse(input),
    completed,
  });
  const task = await assertOwnedTask(data.taskId);
  const todayKey = taskTodayKey(task);
  if (data.dateKey !== todayKey) {
    return { completed: false, stale: true };
  }
  const date = dateKeyToDbDate(todayKey);

  if (completed) {
    if (!isTaskScheduledOnDate(task, todayKey)) {
      throw new Error("Task is not scheduled today");
    }
    await prisma.taskCompletion.upsert({
      where: { taskId_date: { taskId: task.id, date } },
      create: { taskId: task.id, date },
      update: {},
    });
  } else {
    await prisma.taskCompletion.deleteMany({ where: { taskId: task.id, date } });
  }

  revalidatePath("/dashboard");
  return { completed };
}

export async function setTaskCompletion(input: unknown) {
  const data = setTaskCompletionSchema.parse(input);
  return setTaskCompletionForInput(data, data.completed);
}

export async function completeTask(input: unknown) {
  return setTaskCompletionForInput(input, true);
}

export async function revertTaskCompletion(input: unknown) {
  return setTaskCompletionForInput(input, false);
}
