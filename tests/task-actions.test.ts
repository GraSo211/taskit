import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedTask: vi.fn(),
  requireCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  update: vi.fn(),
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
  },
}));

const { updateTask } = await import("../src/app/actions/tasks");

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
    });
    mocks.update.mockResolvedValue({ id: "task-1" });
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
});
