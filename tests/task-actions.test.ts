import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedTask: vi.fn(),
  requireCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/dal", () => ({
  getOwnedTask: mocks.getOwnedTask,
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
  },
}));

const { completeTask, revertTaskCompletion, setTaskCompletion, updateTask } = await import(
  "../src/app/actions/tasks"
);

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

  it("returns an explicit stale result without mutating or revalidating", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T02:00:00.000Z"));
    const staleInput = { taskId: "task-1", dateKey: "2026-08-17" };
    await expect(setTaskCompletion({ ...staleInput, completed: true })).resolves.toEqual({
      completed: false,
      stale: true,
    });
    await expect(completeTask(staleInput)).resolves.toEqual({ completed: false, stale: true });
    await expect(revertTaskCompletion(staleInput)).resolves.toEqual({
      completed: false,
      stale: true,
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
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

  it("keeps fixed-state wrappers date-key based", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
    await completeTask({ taskId: "task-1", dateKey: "2026-08-19" });
    await revertTaskCompletion({ taskId: "task-1", dateKey: "2026-08-19" });
    await expect(completeTask("task-1")).rejects.toThrow();
    vi.useRealTimers();
  });
});
