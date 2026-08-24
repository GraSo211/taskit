"use server";

import { revalidatePath } from "next/cache";

import { getOwnedTask, requireCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { isTaskScheduledOnDate, startOfUtcDay } from "@/lib/task-logic";
import {
  createTaskSchema,
  normalizeTaskData,
  taskIdSchema,
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
      startDate: startOfUtcDay(data.startDate),
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
      startDate: startOfUtcDay(data.startDate),
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

export async function completeTask(input: unknown) {
  const task = await assertOwnedTask(input);
  const date = startOfUtcDay(new Date());
  if (!isTaskScheduledOnDate(task, date)) {
    throw new Error("Task is not scheduled today");
  }

  await prisma.taskCompletion.upsert({
    where: { taskId_date: { taskId: task.id, date } },
    create: { taskId: task.id, date },
    update: {},
  });

  revalidatePath("/dashboard");
  return { completed: true };
}

export async function revertTaskCompletion(input: unknown) {
  const task = await assertOwnedTask(input);
  const date = startOfUtcDay(new Date());

  await prisma.taskCompletion.deleteMany({ where: { taskId: task.id, date } });

  revalidatePath("/dashboard");
  return { completed: false };
}

export async function toggleTaskCompletion(input: unknown) {
  const task = await assertOwnedTask(input);
  const date = startOfUtcDay(new Date());
  const completion = await prisma.taskCompletion.findUnique({
    where: { taskId_date: { taskId: task.id, date } },
  });

  if (completion) {
    await prisma.taskCompletion.delete({ where: { id: completion.id } });
  } else {
    if (!isTaskScheduledOnDate(task, date)) {
      throw new Error("Task is not scheduled today");
    }
    await prisma.taskCompletion.create({ data: { taskId: task.id, date } });
  }

  revalidatePath("/dashboard");
  return { completed: !completion };
}
