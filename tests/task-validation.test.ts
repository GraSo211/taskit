import { describe, expect, it } from "vitest";

import { createTaskSchema, normalizeTaskData } from "../src/lib/task-validation";

const baseTask = {
  title: "Exercise",
  description: "Walk",
  frequency: "DAILY" as const,
  targetCount: 20,
  reminderTime: "08:00",
  timezone: "UTC",
  startDate: "2026-08-19",
};

describe("task schedule validation", () => {
  it("normalizes selected weekdays and forces daily target to one", () => {
    const task = normalizeTaskData(
      createTaskSchema.parse({ ...baseTask, scheduledWeekdays: [5, 1, 5] }),
    );

    expect(task.scheduledWeekdays).toEqual([1, 5]);
    expect(task.targetCount).toBe(1);
  });

  it("clears weekdays for weekly tasks", () => {
    const task = normalizeTaskData(
      createTaskSchema.parse({
        ...baseTask,
        frequency: "WEEKLY",
        targetCount: 3,
        scheduledWeekdays: [1, 3],
      }),
    );

    expect(task.frequency).toBe("WEEKLY");
    expect(task.targetCount).toBe(3);
    expect(task.scheduledWeekdays).toEqual([]);
  });

  it("rejects invalid civil dates and IANA zones", () => {
    expect(() => createTaskSchema.parse({ ...baseTask, startDate: "2026-02-30" })).toThrow();
    expect(() => createTaskSchema.parse({ ...baseTask, timezone: "Not/AZone" })).toThrow();
    expect(() => createTaskSchema.parse({ ...baseTask, startDate: new Date("2026-08-19") })).toThrow();
  });

  it("validates project tasks with an ordered subtask payload", () => {
    const task = normalizeTaskData(
      createTaskSchema.parse({
        title: "Launch",
        type: "PROJECT",
        startDate: "2026-08-19",
        subtasks: [{ title: "Draft" }, { title: "Ship" }],
      }),
    );

    expect(task).toMatchObject({ type: "PROJECT", frequency: null, targetCount: 1 });
    expect(
      (task as Extract<typeof task, { type: "PROJECT" }>).subtasks.map(({ title }) => title),
    ).toEqual(["Draft", "Ship"]);
    expect(() =>
      createTaskSchema.parse({
        title: "Bad project",
        type: "PROJECT",
        subtasks: [{ id: "same", title: "One" }, { id: "same", title: "Two" }],
      }),
    ).toThrow();
  });
});
