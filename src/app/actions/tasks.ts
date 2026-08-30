"use server";

import { Prisma } from "@prisma/client";
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
  addSubtaskSchema,
  deleteSubtaskSchema,
  moveSubtaskSchema,
  renameSubtaskSchema,
  createTaskSchema,
  normalizeTaskData,
  setTaskCompletionSchema,
  subtaskCompletionSchema,
  taskCompletionDateSchema,
  taskIdSchema,
  updateTaskSchema,
} from "@/lib/task-validation";
import {
  deriveSubtaskCompletion,
  getSubtreeIds,
  planSubtaskMove,
  validateSubtaskRows,
  type SubtaskRow,
} from "@/lib/subtask-logic";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function isSerializationConflict(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "P2034";
}

async function withSerializableTransaction<T>(work: (transaction: TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  throw new Error("Transaction retry limit exceeded");
}

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

    revalidateProjectViews();
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
  revalidatePath("/daily");
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

    await prisma.task.update({
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

    revalidateProjectViews();
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
  revalidatePath("/daily");
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
  if (data.dateKey > todayKey) {
    throw new Error(`Task completion date ${data.dateKey} cannot be in the future`);
  }
  const date = dateKeyToDbDate(data.dateKey);

  if (completed) {
    if (!isTaskScheduledOnDate({
      frequency: task.frequency,
      targetCount: task.targetCount,
      scheduledWeekdays: task.scheduledWeekdays,
      startDate: task.startDate,
    }, data.dateKey)) {
      throw new Error(`Task is not scheduled on ${data.dateKey}`);
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
  revalidatePath("/daily");
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

  const result = await withSerializableTransaction(async (transaction) => {
    const rows = await transaction.taskSubtask.findMany({
      where: { taskId: subtask.taskId },
      orderBy: [{ parentId: "asc" }, { position: "asc" }],
    });
    validateSubtaskRows(rows);
    const target = rows.find((row) => row.id === data.subtaskId);
    if (!target) throw new Error("Subtask not found");
    const subtree = getSubtreeIds(rows, target.id);
    const changedRows = rows.map((row) => ({
      ...row,
      completed: subtree.has(row.id) ? data.completed : row.completed,
    }));
    return persistDerivedSubtaskCompletion(transaction, changedRows, subtask.taskId, rows);
  });

  revalidateProjectViews();
  return { completed: data.completed, projectCompleted: result };
}

async function persistDerivedSubtaskCompletion(
  transaction: TransactionClient,
  rows: SubtaskRow[],
  taskId: string,
  previousRows: readonly SubtaskRow[] = rows,
) {
  const completion = deriveSubtaskCompletion(rows);
  const previousById = new Map(previousRows.map((row) => [row.id, row]));
  for (const row of rows) {
    const completed = completion.get(row.id) ?? row.completed;
    if (completed === previousById.get(row.id)?.completed) continue;
    await transaction.taskSubtask.update({
      where: { id: row.id },
      data: { completed },
    });
  }
  const roots = rows.filter((row) => row.parentId === null);
  const projectCompleted = roots.length > 0 && roots.every((root) => completion.get(root.id) === true);
  await transaction.task.update({
    where: { id: taskId },
    data: { completed: projectCompleted },
  });
  return projectCompleted;
}

function revalidateProjectViews() {
  revalidatePath("/dashboard");
  revalidatePath("/projects");
}

async function getProjectForAction(taskId: string, userId: string) {
  const project = await getOwnedProjectTask(taskId, userId);
  if (!project) throw new Error("Project task not found");
  return project;
}

async function getProjectRows(transaction: TransactionClient, taskId: string) {
  const rows = await transaction.taskSubtask.findMany({
    where: { taskId },
    orderBy: [{ parentId: "asc" }, { position: "asc" }],
  });
  validateSubtaskRows(rows);
  return rows as SubtaskRow[];
}

async function rewritePositions(
  transaction: TransactionClient,
  rows: readonly SubtaskRow[],
  positions: Map<string, number>,
  movedId?: string,
  movedParentId?: string | null,
) {
  for (const [index, row] of rows.entries()) {
    await transaction.taskSubtask.update({
      where: { id: row.id },
      data: { position: -(index + 1) },
    });
  }
  for (const row of rows) {
    await transaction.taskSubtask.update({
      where: { id: row.id },
      data: {
        position: positions.get(row.id) ?? row.position,
        ...(row.id === movedId ? { parentId: movedParentId } : {}),
      },
    });
  }
}

export async function addSubtask(input: unknown) {
  const data = addSubtaskSchema.parse(input);
  const user = await requireCurrentUser();
  const project = await getProjectForAction(data.taskId, user.id);
  const result = await withSerializableTransaction(async (transaction) => {
    const rows = await getProjectRows(transaction, project.id);
    if (data.parentId !== null && !rows.some((row) => row.id === data.parentId)) {
      throw new Error("Subtask parent not found");
    }
    const siblings = rows
      .filter((row) => row.parentId === data.parentId)
      .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
    const position = data.position ?? siblings.length;
    if (position > siblings.length) throw new Error("Subtask position is out of range");
    for (const [index, sibling] of siblings.entries()) {
      await transaction.taskSubtask.update({
        where: { id: sibling.id },
        data: { position: -(index + 1) },
      });
    }
    for (const [index, sibling] of siblings.entries()) {
      await transaction.taskSubtask.update({
        where: { id: sibling.id },
        data: { position: index >= position ? index + 1 : index },
      });
    }
    const created = await transaction.taskSubtask.create({
      data: { taskId: project.id, parentId: data.parentId, title: data.title, position },
    });
    const nextRows = [...rows, created as SubtaskRow];
    await persistDerivedSubtaskCompletion(transaction, nextRows, project.id, rows);
    return { id: created.id };
  });
  revalidateProjectViews();
  return result;
}

export const createSubtask = addSubtask;

export async function renameSubtask(input: unknown) {
  const data = renameSubtaskSchema.parse(input);
  const user = await requireCurrentUser();
  const subtask = await getOwnedSubtask(data.subtaskId, data.taskId, user.id);
  if (!subtask) throw new Error("Subtask not found");
  await prisma.taskSubtask.update({ where: { id: subtask.id }, data: { title: data.title } });
  revalidateProjectViews();
  return { id: subtask.id };
}

export const updateSubtask = renameSubtask;

export async function deleteSubtaskBranch(input: unknown) {
  const data = deleteSubtaskSchema.parse(input);
  const user = await requireCurrentUser();
  const project = await getProjectForAction(data.taskId, user.id);
  const result = await withSerializableTransaction(async (transaction) => {
    const rows = await getProjectRows(transaction, project.id);
    if (!rows.some((row) => row.id === data.subtaskId)) throw new Error("Subtask not found");
    const branch = getSubtreeIds(rows, data.subtaskId);
    const deleted = rows.find((row) => row.id === data.subtaskId);
    const remaining = rows.filter((row) => !branch.has(row.id));
    await transaction.taskSubtask.deleteMany({
      where: { taskId: project.id, id: { in: [...branch] } },
    });
    const siblings = remaining
      .filter((row) => row.parentId === deleted?.parentId)
      .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
    const positions = new Map(siblings.map((row, index) => [row.id, index]));
    await rewritePositions(transaction, siblings, positions);
    await persistDerivedSubtaskCompletion(transaction, remaining, project.id, rows);
    return { id: data.subtaskId, deletedCount: branch.size };
  });
  revalidateProjectViews();
  return result;
}

export async function moveSubtask(input: unknown) {
  const data = moveSubtaskSchema.parse(input);
  const user = await requireCurrentUser();
  const project = await getProjectForAction(data.taskId, user.id);
  await withSerializableTransaction(async (transaction) => {
    const rows = await getProjectRows(transaction, project.id);
    const plan = planSubtaskMove(rows, data.subtaskId, data.parentId, data.position);
    await rewritePositions(transaction, rows, plan.positions, data.subtaskId, plan.parentId);
    const changedRows = rows.map((row) => row.id === data.subtaskId
      ? { ...row, parentId: data.parentId }
      : row);
    await persistDerivedSubtaskCompletion(transaction, changedRows, project.id, rows);
  });
  revalidateProjectViews();
  return { id: data.subtaskId, parentId: data.parentId, position: data.position };
}

export const reorderSubtask = moveSubtask;

// Compatibility alias for callers that use the operation name rather than
// the branch-specific behavior.
export const deleteSubtask = deleteSubtaskBranch;
export const removeSubtask = deleteSubtaskBranch;

export const setProjectSubtaskCompletion = setSubtaskCompletion;

export async function completeSubtask(input: unknown) {
  return setSubtaskCompletion({ ...(input as Record<string, unknown>), completed: true });
}

export async function revertSubtaskCompletion(input: unknown) {
  return setSubtaskCompletion({ ...(input as Record<string, unknown>), completed: false });
}
