import { describe, expect, it } from "vitest";

import { buildDailyCalendarGrid } from "../src/components/CompletionCharts";

describe("buildDailyCalendarGrid", () => {
  it("keeps consecutive civil dates in separate weekday cells with their status", () => {
    const cells = buildDailyCalendarGrid(
      [
        { dateKey: "2026-08-18", completed: true, scheduled: true },
        { dateKey: "2026-08-19", completed: false, scheduled: true },
      ],
      1,
    );

    const yesterday = cells.find((cell) => cell.dateKey === "2026-08-18");
    const today = cells.find((cell) => cell.dateKey === "2026-08-19");

    expect(yesterday).toMatchObject({
      dateKey: "2026-08-18",
      column: 0,
      row: 2,
      point: { dateKey: "2026-08-18", completed: true, scheduled: true },
    });
    expect(today).toMatchObject({
      dateKey: "2026-08-19",
      column: 0,
      row: 3,
      point: { dateKey: "2026-08-19", completed: false, scheduled: true },
    });
    expect(yesterday?.dateKey).not.toBe(today?.dateKey);
    expect(today?.point?.completed).toBe(false);
    expect(yesterday?.point?.completed).toBe(true);
  });
});
