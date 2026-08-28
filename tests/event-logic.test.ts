import { describe, expect, it } from "vitest";

import { projectEvent } from "../src/lib/event-logic";

const event = {
  startDate: "2026-08-18",
  duration: 5,
  timezone: "UTC",
  mode: "MANUAL" as const,
  failurePolicy: "CONTINUE" as const,
};

describe("event projection", () => {
  it("projects upcoming, pending, completed, and failed days without writing", () => {
    const result = projectEvent(
      event,
      [{ dateKey: "2026-08-18", outcome: "COMPLETED" }, { dateKey: "2026-08-19", outcome: "FAILED" }],
      new Date("2026-08-20T12:00:00.000Z"),
    );

    expect(result.days).toEqual([
      { dateKey: "2026-08-18", status: "COMPLETED", outcome: "COMPLETED" },
      { dateKey: "2026-08-19", status: "FAILED", outcome: "FAILED" },
      { dateKey: "2026-08-20", status: "PENDING", outcome: null },
      { dateKey: "2026-08-21", status: "UPCOMING", outcome: null },
      { dateKey: "2026-08-22", status: "UPCOMING", outcome: null },
    ]);
  });

  it("infers past outcomes by mode and blocks later days with STOP", () => {
    expect(projectEvent(
      { ...event, mode: "MANUAL", failurePolicy: "STOP" },
      [],
      new Date("2026-08-20T12:00:00.000Z"),
    ).days).toEqual([
      { dateKey: "2026-08-18", status: "FAILED", outcome: "FAILED" },
      { dateKey: "2026-08-19", status: "BLOCKED", outcome: null },
      { dateKey: "2026-08-20", status: "BLOCKED", outcome: null },
      { dateKey: "2026-08-21", status: "BLOCKED", outcome: null },
      { dateKey: "2026-08-22", status: "BLOCKED", outcome: null },
    ]);

    expect(projectEvent(
      { ...event, mode: "AUTOMATIC", failurePolicy: "CONTINUE" },
      [],
      new Date("2026-08-20T12:00:00.000Z"),
    ).days.slice(0, 3)).toEqual([
      { dateKey: "2026-08-18", status: "COMPLETED", outcome: "COMPLETED" },
      { dateKey: "2026-08-19", status: "COMPLETED", outcome: "COMPLETED" },
      { dateKey: "2026-08-20", status: "PENDING", outcome: null },
    ]);
  });
});
