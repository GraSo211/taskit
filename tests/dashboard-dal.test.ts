import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findTasks: vi.fn(),
  findCompletions: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findMany: mocks.findTasks },
    taskCompletion: { findMany: mocks.findCompletions },
  },
}));

const { getDashboardData } = await import("../src/lib/dal");

const dailyTask = {
  id: "daily-1",
  userId: "user-1",
  title: "Daily",
  description: null,
  frequency: "DAILY" as const,
  targetCount: 1,
  scheduledWeekdays: [1, 3, 5],
  reminderTime: null,
  timezone: "America/Los_Angeles",
  startDate: new Date("2026-05-01T00:00:00.000Z"),
  isActive: true,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
};

const weeklyTask = {
  id: "weekly-1",
  userId: "user-1",
  title: "Weekly",
  description: null,
  frequency: "WEEKLY" as const,
  targetCount: 2,
  scheduledWeekdays: [],
  reminderTime: null,
  timezone: "UTC",
  startDate: new Date("2026-07-01T00:00:00.000Z"),
  isActive: true,
  createdAt: new Date("2026-07-02T00:00:00.000Z"),
};

describe("getDashboardData history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1", name: "User", email: "santigs211@gmail.com", image: null },
    });
    mocks.findTasks.mockResolvedValue([dailyTask, weeklyTask]);
    mocks.findCompletions.mockResolvedValue([
      { taskId: "daily-1", date: new Date("2026-08-18T00:00:00.000Z") },
      { taskId: "daily-1", date: new Date("2026-08-19T00:00:00.000Z") },
      { taskId: "weekly-1", date: new Date("2026-08-17T00:00:00.000Z") },
      { taskId: "weekly-1", date: new Date("2026-08-23T00:00:00.000Z") },
      { taskId: "other-user-task", date: new Date("2026-08-19T00:00:00.000Z") },
    ]);
  });

  it("returns 84 civil daily points, clamps to startDate, and keeps schedule separate", async () => {
    const data = await getDashboardData(new Date("2026-08-20T01:30:00.000Z"));
    const task = data.tasks.find((item) => item.id === "daily-1");

    expect(task?.history.daily).toMatchObject({
      startDate: "2026-05-28",
      endDate: "2026-08-19",
    });
    expect(task?.history.daily?.points).toHaveLength(84);
    expect(task?.history.daily?.points.at(0)).toEqual({
      dateKey: "2026-05-28",
      completed: false,
      scheduled: false,
    });
    expect(task?.history.daily?.points.slice(-2)).toEqual([
      { dateKey: "2026-08-18", completed: true, scheduled: false },
      { dateKey: "2026-08-19", completed: true, scheduled: true },
    ]);
  });

  it("clamps daily history and emits an inclusive Monday-to-Sunday weekly window", async () => {
    mocks.findTasks.mockResolvedValue([
      { ...dailyTask, startDate: new Date("2026-08-18T00:00:00.000Z") },
      weeklyTask,
    ]);

    const data = await getDashboardData(new Date("2026-08-20T01:30:00.000Z"));
    const daily = data.tasks.find((item) => item.id === "daily-1");
    const weekly = data.tasks.find((item) => item.id === "weekly-1");

    expect(daily?.history.daily).toMatchObject({ startDate: "2026-08-18", endDate: "2026-08-19" });
    expect(daily?.history.daily?.points.map(({ dateKey }) => dateKey)).toEqual([
      "2026-08-18",
      "2026-08-19",
    ]);
    expect(weekly?.history.weekly).toMatchObject({
      weekStart: "2026-08-17",
      weekEnd: "2026-08-23",
      completed: 2,
      target: 2,
    });
    expect(weekly?.history.weekly?.days).toEqual([
      { dateKey: "2026-08-17", completed: true },
      { dateKey: "2026-08-18", completed: false },
      { dateKey: "2026-08-19", completed: false },
      { dateKey: "2026-08-20", completed: false },
      { dateKey: "2026-08-21", completed: false },
      { dateKey: "2026-08-22", completed: false },
      { dateKey: "2026-08-23", completed: true },
    ]);
  });

  it("uses one user-scoped completion query covering the required history", async () => {
    await getDashboardData(new Date("2026-08-20T01:30:00.000Z"));

    expect(mocks.findCompletions).toHaveBeenCalledTimes(1);
    expect(mocks.findCompletions).toHaveBeenCalledWith({
      where: {
        taskId: { in: ["daily-1", "weekly-1"] },
        date: {
          gte: new Date("2026-05-28T00:00:00.000Z"),
          lt: new Date("2026-08-24T00:00:00.000Z"),
        },
      },
      orderBy: { date: "asc" },
    });
  });

  it("keeps project tasks out of routine aggregates and exposes ordered project data", async () => {
    mocks.findTasks.mockResolvedValue([
      dailyTask,
      weeklyTask,
      {
        id: "project-1",
        userId: "user-1",
        title: "Launch",
        description: null,
        type: "PROJECT",
        frequency: null,
        targetCount: 1,
        scheduledWeekdays: [],
        reminderTime: null,
        timezone: "UTC",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        isActive: true,
        subtasks: [
          { id: "sub-2", title: "Ship", position: 1, completed: true },
          { id: "sub-1", title: "Draft", position: 0, completed: true },
        ],
      },
    ]);

    const data = await getDashboardData(new Date("2026-08-20T01:30:00.000Z"));

    expect(data.progress.daily).toMatchObject({ completed: 1, target: 1 });
    expect(data.progress.weekly).toMatchObject({ completed: 2, target: 2 });
    expect(data.projects[0]).toMatchObject({ id: "project-1", completed: true });
    expect(data.projects[0].subtasks.map(({ id }) => id)).toEqual(["sub-1", "sub-2"]);
    expect(mocks.findCompletions).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ taskId: { in: ["daily-1", "weekly-1"] } }),
    }));
  });
});
