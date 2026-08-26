import { describe, expect, it } from "vitest";

import {
  aggregateProgress,
  calculateProgress,
  countScheduledDaysInWeek,
  getTaskWindow,
  getUtcDayWindow,
  getUtcWeekWindow,
  isTaskScheduledOnDate,
} from "../src/lib/task-logic";
import {
  addDays,
  dateKeyToDbDate,
  dbDateToDateKey,
  getMondayWeekWindow,
  localDateKey,
  normalizeTimezone,
  weekdayOfDateKey,
} from "../src/lib/task-time";

const date = new Date("2026-08-19T15:30:00.000Z");

describe("UTC task windows", () => {
  it("returns the current UTC day", () => {
    expect(getUtcDayWindow(date)).toEqual({
      start: new Date("2026-08-19T00:00:00.000Z"),
      end: new Date("2026-08-20T00:00:00.000Z"),
    });
  });

  it("returns a Monday-to-Monday UTC week", () => {
    expect(getUtcWeekWindow(date)).toEqual({
      start: new Date("2026-08-17T00:00:00.000Z"),
      end: new Date("2026-08-24T00:00:00.000Z"),
    });
  });

  it("selects the window from task frequency", () => {
    expect(getTaskWindow("DAILY", date)).toEqual(getUtcDayWindow(date));
    expect(getTaskWindow("WEEKLY", date)).toEqual(getUtcWeekWindow(date));
  });
});

describe("civil date and timezone helpers", () => {
  it("round-trips PostgreSQL DATE values and converts local dates", () => {
    const key = "2026-08-19";
    expect(dbDateToDateKey(dateKeyToDbDate(key))).toBe(key);
    expect(localDateKey(new Date("2026-08-19T01:30:00.000Z"), "America/Los_Angeles")).toBe(
      "2026-08-18",
    );
  });

  it("calculates weekday and Monday windows from date keys", () => {
    expect(weekdayOfDateKey("2026-08-19")).toBe(3);
    expect(getMondayWeekWindow("2026-08-19")).toEqual({ start: "2026-08-17", end: "2026-08-24" });
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(normalizeTimezone(" America/New_York ")).toBe("America/New_York");
  });
});

describe("task progress", () => {
  it("treats an empty daily schedule as every day", () => {
    expect(isTaskScheduledOnDate({ frequency: "DAILY", targetCount: 1 }, date)).toBe(true);
    expect(
      isTaskScheduledOnDate(
        { frequency: "DAILY", targetCount: 1, scheduledWeekdays: [1, 3, 5] },
        date,
      ),
    ).toBe(true);
    expect(
      isTaskScheduledOnDate(
        { frequency: "DAILY", targetCount: 1, scheduledWeekdays: [1, 5] },
        date,
      ),
    ).toBe(false);
  });

  it("calculates daily and weekly progress for daily tasks", () => {
    const progress = calculateProgress(
      { frequency: "DAILY", targetCount: 1 },
      [new Date("2026-08-17T00:00:00Z"), new Date("2026-08-19T00:00:00Z")],
      date,
    );

    expect(progress.daily).toMatchObject({ completed: 1, target: 1, percentage: 100 });
    expect(progress.weekly).toMatchObject({ completed: 2, target: 7, percentage: 29 });
  });

  it("uses the weekly target for weekly tasks and caps percentage", () => {
    const progress = calculateProgress(
      { frequency: "WEEKLY", targetCount: 2 },
      [
        new Date("2026-08-18T00:00:00Z"),
        new Date("2026-08-19T00:00:00Z"),
        new Date("2026-08-20T00:00:00Z"),
      ],
      date,
    );

    expect(progress.daily).toMatchObject({ completed: 1, target: 2, percentage: 50 });
    expect(progress.weekly).toMatchObject({ completed: 3, target: 2, percentage: 100, isComplete: true });
  });

  it("aggregates board progress", () => {
    expect(
      aggregateProgress([
        { completed: 1, target: 1, percentage: 100, isComplete: true },
        { completed: 1, target: 2, percentage: 50, isComplete: false },
      ]),
    ).toMatchObject({ completed: 2, target: 3, percentage: 67, isComplete: false });
  });

  it("counts only selected weekdays in daily weekly progress", () => {
    const progress = calculateProgress(
      { frequency: "DAILY", targetCount: 1, scheduledWeekdays: [1, 3, 5] },
      [
        new Date("2026-08-17T00:00:00Z"),
        new Date("2026-08-18T00:00:00Z"),
        new Date("2026-08-19T00:00:00Z"),
      ],
      date,
    );

    expect(progress.weekly).toMatchObject({ completed: 2, target: 3, percentage: 67 });
  });

  it("counts only scheduled days on or after the civil start date", () => {
    expect(
      countScheduledDaysInWeek(
        { frequency: "DAILY", targetCount: 1, startDate: "2026-08-19", scheduledWeekdays: [1, 3, 5] },
        "2026-08-19",
      ),
    ).toBe(2);
  });
});
