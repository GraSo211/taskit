import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findTasks: vi.fn(),
  findCompletions: vi.fn(),
  findWeeklyProgress: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findMany: mocks.findTasks },
    taskCompletion: { findMany: mocks.findCompletions },
    weeklyTaskProgress: { findMany: mocks.findWeeklyProgress },
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
      { taskId: "other-user-task", date: new Date("2026-08-19T00:00:00.000Z") },
    ]);
    mocks.findWeeklyProgress.mockResolvedValue([
      { taskId: "weekly-1", weekStart: new Date("2026-08-17T00:00:00.000Z"), achievedCount: 2 },
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

  it("clamps daily history and emits the selected Monday-to-Sunday weekly window", async () => {
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
    expect(weekly?.history.weekly).toEqual({
      weekStart: "2026-08-17",
      weekEnd: "2026-08-23",
      completed: 2,
      target: 2,
    });
    expect(weekly?.history.weekly).not.toHaveProperty("days");
  });

  it("uses one user-scoped completion query covering the required history", async () => {
    await getDashboardData(new Date("2026-08-20T01:30:00.000Z"));

    expect(mocks.findCompletions).toHaveBeenCalledTimes(1);
    expect(mocks.findCompletions).toHaveBeenCalledWith({
      where: {
        taskId: { in: ["daily-1"] },
        date: {
          gte: new Date("2026-05-28T00:00:00.000Z"),
          lt: new Date("2026-08-20T00:00:00.000Z"),
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
      where: expect.objectContaining({ taskId: { in: ["daily-1"] } }),
    }));
    expect(mocks.findWeeklyProgress).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ taskId: { in: ["weekly-1"] } }),
    }));
  });

  it("projects a selected civil date into daily routine status and editability", async () => {
    const data = await getDashboardData(new Date("2026-08-20T01:30:00.000Z"), "2026-08-21");
    const task = data.tasks.find((item) => item.id === "daily-1");

    expect(task).toMatchObject({
      todayKey: "2026-08-19",
      completedToday: true,
      selectedDateKey: "2026-08-21",
      completedOnSelectedDate: false,
      canCompleteSelectedDate: false,
    });
    expect(data.tasks.some((item) => item.id === "daily-1")).toBe(true);
  });

  it("uses a selected date's week for weekly progress, history, and task visibility", async () => {
    mocks.findCompletions.mockResolvedValue([
      { taskId: "daily-1", date: new Date("2026-07-09T00:00:00.000Z") },
    ]);
    mocks.findWeeklyProgress.mockResolvedValue([
      { taskId: "weekly-1", weekStart: new Date("2026-07-06T00:00:00.000Z"), achievedCount: 10 },
    ]);

    const data = await getDashboardData(new Date("2026-08-20T01:30:00.000Z"), "2026-07-09");
    const weekly = data.tasks.find((item) => item.id === "weekly-1");

    expect(data.progress.weekly).toMatchObject({ completed: 10, target: 2, percentage: 100 });
    expect(weekly).toMatchObject({
      selectedWeekStart: "2026-07-06",
      completedInSelectedWeek: 10,
      canEditSelectedWeek: true,
    });
    expect(weekly?.history.weekly).toEqual({
      weekStart: "2026-07-06",
      weekEnd: "2026-07-12",
      completed: 10,
      target: 2,
    });
    expect(data.tasks.map((task) => task.id)).toEqual(["weekly-1"]);
    expect(mocks.findWeeklyProgress).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        taskId: { in: ["weekly-1"] },
        weekStart: {
          gte: new Date("2026-07-06T00:00:00.000Z"),
          lt: new Date("2026-07-13T00:00:00.000Z"),
        },
      }),
    }));
  });

  it("reads a partial first week and keeps a future selected week read-only", async () => {
    mocks.findTasks.mockResolvedValue([{ ...weeklyTask, startDate: new Date("2026-07-09T00:00:00.000Z") }]);
    mocks.findWeeklyProgress.mockResolvedValue([
      { taskId: "weekly-1", weekStart: new Date("2026-07-06T00:00:00.000Z"), achievedCount: 1 },
    ]);

    const firstWeek = await getDashboardData(new Date("2026-08-20T12:00:00.000Z"), "2026-07-06");
    expect(firstWeek.tasks[0]).toMatchObject({
      selectedWeekStart: "2026-07-06",
      completedInSelectedWeek: 1,
      canEditSelectedWeek: true,
    });

    mocks.findWeeklyProgress.mockResolvedValue([
      { taskId: "weekly-1", weekStart: new Date("2026-08-24T00:00:00.000Z"), achievedCount: 4 },
    ]);
    const futureWeek = await getDashboardData(new Date("2026-08-20T12:00:00.000Z"), "2026-08-27");
    expect(futureWeek.tasks[0]).toMatchObject({
      selectedWeekStart: "2026-08-24",
      completedInSelectedWeek: 4,
      canEditSelectedWeek: false,
    });
  });

  it("ends selected daily history and progress at the selected date", async () => {
    mocks.findCompletions.mockResolvedValue([
      { taskId: "daily-1", date: new Date("2026-08-10T00:00:00.000Z") },
    ]);
    mocks.findWeeklyProgress.mockResolvedValue([]);

    const data = await getDashboardData(new Date("2026-08-20T01:30:00.000Z"), "2026-08-10");
    const daily = data.tasks.find((item) => item.id === "daily-1");

    expect(data.progress.daily).toMatchObject({ completed: 1, target: 1 });
    expect(daily?.progress.daily).toMatchObject({ completed: 1, target: 1 });
    expect(daily?.history.daily).toMatchObject({
      startDate: "2026-05-19",
      endDate: "2026-08-10",
    });
    expect(daily?.history.daily?.points).toHaveLength(84);
    expect(daily?.history.daily?.points.at(-1)).toEqual({
      dateKey: "2026-08-10",
      completed: true,
      scheduled: true,
    });
    expect(mocks.findCompletions).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        date: {
          gte: new Date("2026-05-19T00:00:00.000Z"),
          lt: new Date("2026-08-11T00:00:00.000Z"),
        },
      }),
    }));
  });

  it("falls back to each task's local today for an invalid selected date", async () => {
    const data = await getDashboardData(new Date("2026-08-20T01:30:00.000Z"), "2026-02-30");
    const task = data.tasks.find((item) => item.id === "daily-1");

    expect(task).toMatchObject({
      selectedDateKey: "2026-08-19",
      completedToday: true,
      completedOnSelectedDate: true,
      canCompleteSelectedDate: true,
    });
  });
});
