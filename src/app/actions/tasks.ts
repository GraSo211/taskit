"use server";

import { revalidatePath } from "next/cache";

import {
  getOwnedProjectTask,
  getOwnedSubtask,
  getOwnedTask,
  requireCurrentUser,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { isTaskScheduledOnDate } from "@/lib/task-logic";
import { dateKeyToDbDate, localDateKey } from "@/lib/task-time";
import {
  createTaskSchema,
  normalizeTaskData,
  setTaskCompletionSchema,
  subtaskCompletionSchema,
  taskCompletionDateSchema,
  taskIdSchema,
  updateTaskSchema,
} from "@/lib/task-validation";

export async function createTask(input: unknown) {
  const user = await requireCurrentUser();
  const data = normalizeTaskData(createTaskSchema.parse(input));

  if (data.type === "PROJECT") {
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        type: "PROJECT",
        frequency: null,
        targetCount: 1,
        scheduledWeekdays: [],
        title: data.title,
        description: data.description || null,
        reminderTime: data.reminderTime || null,
        timezone: data.timezone,
        startDate: dateKeyToDbDate(data.startDate),
        subtasks: {
          create: data.subtasks.map((subtask, position) => ({
            title: subtask.title,
            position,
          })),
        },
      },
    });

    revalidatePath("/dashboard");
    return { id: task.id };
  }

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      type: "ROUTINE",
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

  if (data.type === "PROJECT") {
    const project = await getOwnedProjectTask(data.taskId, user.id);
    if (!project) throw new Error("Project task not found");

    await prisma.$transaction(async (transaction) => {
      await transaction.task.update({
        where: { id: project.id },
        data: {
          title: data.title,
          description: data.description || null,
          type: "PROJECT",
          frequency: null,
          targetCount: 1,
          scheduledWeekdays: [],
          reminderTime: data.reminderTime || null,
          timezone: data.timezone,
          startDate: dateKeyToDbDate(data.startDate),
        },
      });

      const existingById = new Map(project.subtasks.map((subtask) => [subtask.id, subtask]));
      const retainedIds = data.subtasks.flatMap((subtask) => (subtask.id ? [subtask.id] : []));
      for (const id of retainedIds) {
        if (!existingById.has(id)) throw new Error("Subtask not found");
      }

      await transaction.taskSubtask.deleteMany({
        where: { taskId: project.id, id: { notIn: retainedIds } },
      });

      // Clear positions first so swapping two subtasks cannot violate the
      // unique (taskId, position) constraint.
      for (const [index, id] of retainedIds.entries()) {
        await transaction.taskSubtask.update({
          where: { id },
          data: { position: -(index + 1) },
        });
      }
      for (const [position, subtask] of data.subtasks.entries()) {
        if (subtask.id) {
          await transaction.taskSubtask.update({
            where: { id: subtask.id },
            data: { title: subtask.title, position },
          });
        } else {
          await transaction.taskSubtask.create({
            data: { taskId: project.id, title: subtask.title, position },
          });
        }
      }

      const completed = data.subtasks.length > 0 && data.subtasks.every((subtask) => {
        return subtask.id ? existingById.get(subtask.id)?.completed === true : false;
      });
      await transaction.task.update({ where: { id: project.id }, data: { completed } });
    });

    revalidatePath("/dashboard");
    return { id: project.id };
  }

  await prisma.task.update({
    where: { id: task.id },
    data: {
      type: "ROUTINE",
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
  if (task.type === "PROJECT" || !task.frequency) {
    throw new Error("Project completion is derived from subtasks");
  }

  const todayKey = taskTodayKey(task);
  if (data.dateKey !== todayKey) {
    return { completed: false, stale: true };
  }
  const date = dateKeyToDbDate(todayKey);

  if (completed) {
    if (!isTaskScheduledOnDate({
      frequency: task.frequency,
      targetCount: task.targetCount,
      scheduledWeekdays: task.scheduledWeekdays,
      startDate: task.startDate,
    }, todayKey)) {
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

export async function setSubtaskCompletion(input: unknown) {
  const data = subtaskCompletionSchema.parse(input);
  const user = await requireCurrentUser();
  const subtask = await getOwnedSubtask(data.subtaskId, data.taskId, user.id);
  if (!subtask) throw new Error("Subtask not found");

  const result = await prisma.$transaction(async (transaction) => {
    await transaction.taskSubtask.update({
      where: { id: subtask.id },
      data: { completed: data.completed },
    });
    const [remaining, total] = await Promise.all([
      transaction.taskSubtask.count({ where: { taskId: subtask.taskId, completed: false } }),
      transaction.taskSubtask.count({ where: { taskId: subtask.taskId } }),
    ]);
    const projectCompleted = total > 0 && remaining === 0;
    await transaction.task.update({
      where: { id: subtask.taskId },
      data: { completed: projectCompleted },
    });
    return projectCompleted;
  });

  revalidatePath("/dashboard");
  return { completed: data.completed, projectCompleted: result };
}

export const setProjectSubtaskCompletion = setSubtaskCompletion;

export async function completeSubtask(input: unknown) {
  return setSubtaskCompletion({ ...(input as Record<string, unknown>), completed: true });
}

export async function revertSubtaskCompletion(input: unknown) {
  return setSubtaskCompletion({ ...(input as Record<string, unknown>), completed: false });
}
