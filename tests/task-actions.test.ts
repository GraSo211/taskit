import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedTask: vi.fn(),
  getOwnedProjectTask: vi.fn(),
  getOwnedSubtask: vi.fn(),
  requireCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  weeklyUpsert: vi.fn(),
  weeklyDeleteMany: vi.fn(),
  subtaskUpdate: vi.fn(),
  subtaskFindMany: vi.fn(),
  subtaskCount: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/dal", () => ({
  getOwnedTask: mocks.getOwnedTask,
  getOwnedProjectTask: mocks.getOwnedProjectTask,
  getOwnedSubtask: mocks.getOwnedSubtask,
  requireCurrentUser: mocks.requireCurrentUser,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      update: mocks.update,
    },
    taskCompletion: {
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
    },
    weeklyTaskProgress: {
      upsert: mocks.weeklyUpsert,
      deleteMany: mocks.weeklyDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

const { completeTask, revertTaskCompletion, setSubtaskCompletion, setTaskCompletion, setWeeklyCompletionCount, updateTask } =
  await import("../src/app/actions/tasks");

describe("updateTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.getOwnedTask.mockResolvedValue({
      id: "task-1",
      userId: "user-1",
      frequency: "DAILY",
      targetCount: 1,
      scheduledWeekdays: [],
      startDate: new Date("2026-08-19T00:00:00.000Z"),
      timezone: "America/New_York",
    });
    mocks.update.mockResolvedValue({ id: "task-1" });
    mocks.upsert.mockResolvedValue({ id: "completion-1" });
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    mocks.getOwnedSubtask.mockResolvedValue({ id: "sub-1", taskId: "project-1" });
    mocks.subtaskUpdate.mockResolvedValue({ id: "sub-1", completed: true });
    mocks.subtaskFindMany.mockResolvedValue([
      { id: "sub-1", taskId: "project-1", parentId: null, title: "Step", position: 0, completed: false },
    ]);
    mocks.subtaskCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);
    mocks.transaction.mockImplementation(async (callback) => callback({
      task: { update: mocks.update },
      taskSubtask: { update: mocks.subtaskUpdate, findMany: mocks.subtaskFindMany, count: mocks.subtaskCount },
    }));
  });

  it("authorizes ownership and clears weekdays when switching to weekly", async () => {
    await updateTask({
      taskId: "task-1",
      title: "Read",
      description: null,
      frequency: "WEEKLY",
      targetCount: 3,
      scheduledWeekdays: [1, 3],
      reminderTime: null,
      timezone: "UTC",
      startDate: "2026-08-19",
    });

    expect(mocks.getOwnedTask).toHaveBeenCalledWith("task-1", "user-1");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        frequency: "WEEKLY",
        targetCount: 3,
        scheduledWeekdays: [],
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects a task owned by another user", async () => {
    mocks.getOwnedTask.mockResolvedValueOnce(null);

    await expect(
      updateTask({
        taskId: "other-task",
        title: "Read",
        frequency: "DAILY",
        targetCount: 4,
        startDate: "2026-08-19",
      }),
    ).rejects.toThrow("Task not found");

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates project metadata without requiring or synchronizing a flat subtask payload", async () => {
    mocks.getOwnedTask.mockResolvedValueOnce({
      id: "project-1",
      userId: "user-1",
      type: "PROJECT",
      frequency: null,
      startDate: new Date("2026-08-19T00:00:00.000Z"),
      timezone: "UTC",
    });
    mocks.getOwnedProjectTask.mockResolvedValueOnce({ id: "project-1", subtasks: [] });

    await expect(updateTask({
      taskId: "project-1",
      type: "PROJECT",
      title: "Updated project",
      description: null,
      startDate: "2026-08-19",
      timezone: "UTC",
    })).resolves.toEqual({ id: "project-1" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: expect.objectContaining({ title: "Updated project" }),
    });
  });

  it("rejects future dates without mutating or revalidating", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T02:00:00.000Z"));
    const futureInput = { taskId: "task-1", dateKey: "2026-08-19" };
    await expect(setTaskCompletion({ ...futureInput, completed: true })).rejects.toThrow(
      "cannot be in the future",
    );
    await expect(completeTask(futureInput)).rejects.toThrow("cannot be in the future");
    await expect(revertTaskCompletion(futureInput)).rejects.toThrow("cannot be in the future");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("sets and clears completion for a scheduled past local date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"));
    mocks.getOwnedTask.mockResolvedValueOnce({
      id: "task-1",
      userId: "user-1",
      frequency: "DAILY",
      targetCount: 1,
      scheduledWeekdays: [],
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      timezone: "America/New_York",
    });

    const input = { taskId: "task-1", dateKey: "2026-08-19" };
    await expect(completeTask(input)).resolves.toEqual({ completed: true });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { taskId_date: { taskId: "task-1", date: new Date("2026-08-19T00:00:00.000Z") } },
      create: { taskId: "task-1", date: new Date("2026-08-19T00:00:00.000Z") },
      update: {},
    });

    await expect(revertTaskCompletion(input)).resolves.toEqual({ completed: false });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "task-1", date: new Date("2026-08-19T00:00:00.000Z") },
    });
    vi.useRealTimers();
  });

  it("validates the requested date when completing a routine", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"));
    mocks.getOwnedTask.mockResolvedValueOnce({
      id: "task-1",
      userId: "user-1",
      frequency: "DAILY",
      targetCount: 1,
      scheduledWeekdays: [1],
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      timezone: "America/New_York",
    });

    await expect(completeTask({ taskId: "task-1", dateKey: "2026-08-19" })).rejects.toThrow(
      "Task is not scheduled on 2026-08-19",
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("sets and clears completion idempotently at the task-local civil date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
    const input = { taskId: "task-1", dateKey: "2026-08-19", completed: true };
    await expect(setTaskCompletion(input)).resolves.toEqual({ completed: true });
    await expect(setTaskCompletion(input)).resolves.toEqual({ completed: true });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { taskId_date: { taskId: "task-1", date: new Date("2026-08-19T00:00:00.000Z") } },
      create: { taskId: "task-1", date: new Date("2026-08-19T00:00:00.000Z") },
      update: {},
    });

    await expect(setTaskCompletion({ ...input, completed: false })).resolves.toEqual({
      completed: false,
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "task-1", date: new Date("2026-08-19T00:00:00.000Z") },
    });
    vi.useRealTimers();
  });

  it("sets an absolute weekly counter idempotently without capping it at the target", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"));
    mocks.getOwnedTask.mockResolvedValue({
      id: "weekly-1",
      userId: "user-1",
      type: "ROUTINE",
      frequency: "WEEKLY",
      targetCount: 2,
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      timezone: "UTC",
    });

    await expect(setWeeklyCompletionCount({
      taskId: "weekly-1",
      weekStart: "2026-08-17",
      count: 10,
    })).resolves.toEqual({ taskId: "weekly-1", weekStart: "2026-08-17", count: 10 });
    expect(mocks.weeklyUpsert).toHaveBeenCalledWith({
      where: { taskId_weekStart: { taskId: "weekly-1", weekStart: new Date("2026-08-17T00:00:00.000Z") } },
      create: { taskId: "weekly-1", weekStart: new Date("2026-08-17T00:00:00.000Z"), achievedCount: 10 },
      update: { achievedCount: 10 },
    });

    await expect(setWeeklyCompletionCount({
      taskId: "weekly-1",
      weekStart: "2026-08-17",
      count: 10,
    })).resolves.toEqual({ taskId: "weekly-1", weekStart: "2026-08-17", count: 10 });
    expect(mocks.weeklyUpsert).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("clears a weekly counter with zero and rejects daily tasks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"));
    mocks.getOwnedTask.mockResolvedValueOnce({
      id: "weekly-1",
      userId: "user-1",
      type: "ROUTINE",
      frequency: "WEEKLY",
      targetCount: 2,
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      timezone: "UTC",
    });

    await expect(setWeeklyCompletionCount({
      taskId: "weekly-1",
      weekStart: "2026-08-17",
      count: 0,
    })).resolves.toEqual({ taskId: "weekly-1", weekStart: "2026-08-17", count: 0 });
    expect(mocks.weeklyDeleteMany).toHaveBeenCalledWith({
      where: { taskId: "weekly-1", weekStart: new Date("2026-08-17T00:00:00.000Z") },
    });

    await expect(setWeeklyCompletionCount({
      taskId: "task-1",
      weekStart: "2026-08-17",
      count: 1,
    })).rejects.toThrow("only available for weekly routines");
    expect(mocks.weeklyUpsert).not.toHaveBeenCalled();

    mocks.getOwnedTask.mockResolvedValueOnce({
      id: "weekly-1",
      userId: "user-1",
      type: "ROUTINE",
      frequency: "WEEKLY",
      targetCount: 2,
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      timezone: "UTC",
    });
    await expect(setTaskCompletion({
      taskId: "weekly-1",
      dateKey: "2026-08-20",
      completed: true,
    })).rejects.toThrow("only available for daily routines");
    expect(mocks.upsert).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("accepts a past partial first week but rejects non-Monday and future weeks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"));
    mocks.getOwnedTask.mockResolvedValue({
      id: "weekly-1",
      userId: "user-1",
      type: "ROUTINE",
      frequency: "WEEKLY",
      targetCount: 2,
      startDate: new Date("2026-08-19T00:00:00.000Z"),
      timezone: "UTC",
    });

    await expect(setWeeklyCompletionCount({
      taskId: "weekly-1",
      weekStart: "2026-08-17",
      count: 1,
    })).resolves.toMatchObject({ count: 1 });
    expect(mocks.weeklyUpsert).toHaveBeenCalledTimes(1);

    await expect(setWeeklyCompletionCount({
      taskId: "weekly-1",
      weekStart: "2026-08-18",
      count: 1,
    })).rejects.toThrow("must be a Monday");
    await expect(setWeeklyCompletionCount({
      taskId: "weekly-1",
      weekStart: "2026-08-10",
      count: 1,
    })).rejects.toThrow("does not overlap");
    await expect(setWeeklyCompletionCount({
      taskId: "weekly-1",
      weekStart: "2026-08-24",
      count: 1,
    })).rejects.toThrow("future");
    expect(mocks.weeklyUpsert).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("keeps fixed-state wrappers date-key based", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
    await completeTask({ taskId: "task-1", dateKey: "2026-08-19" });
    await revertTaskCompletion({ taskId: "task-1", dateKey: "2026-08-19" });
    await expect(completeTask("task-1")).rejects.toThrow();
    vi.useRealTimers();
  });

  it("authorizes and idempotently derives project completion from subtasks", async () => {
    await expect(
      setSubtaskCompletion({ taskId: "project-1", subtaskId: "sub-1", completed: true }),
    ).resolves.toEqual({ completed: true, projectCompleted: true });
    await expect(
      setSubtaskCompletion({ taskId: "project-1", subtaskId: "sub-1", completed: true }),
    ).resolves.toEqual({ completed: true, projectCompleted: true });

    expect(mocks.getOwnedSubtask).toHaveBeenCalledWith("sub-1", "project-1", "user-1");
    expect(mocks.subtaskUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { completed: true },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { completed: true },
    });
  });

  it("does not mutate a subtask that is not owned by the current user", async () => {
    mocks.getOwnedSubtask.mockResolvedValueOnce(null);

    await expect(
      setSubtaskCompletion({ taskId: "project-1", subtaskId: "other-subtask", completed: true }),
    ).rejects.toThrow("Subtask not found");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
