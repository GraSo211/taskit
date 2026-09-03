import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedEvent: vi.fn(),
  requireCurrentUser: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/dal", () => ({
  getOwnedEvent: mocks.getOwnedEvent,
  requireCurrentUser: mocks.requireCurrentUser,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { create: mocks.create, update: mocks.update, delete: mocks.delete },
    eventDayMark: { upsert: mocks.upsert, deleteMany: mocks.deleteMany, findMany: mocks.findMany },
  },
}));

const { createEvent, setEventDayOutcome, updateEvent } = await import("../src/app/actions/events");

describe("event actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"));
    mocks.requireCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.getOwnedEvent.mockResolvedValue({
      id: "event-1",
      userId: "user-1",
      type: "EVENT",
      eventMode: "AUTOMATIC",
      eventDuration: 5,
      eventFailurePolicy: "STOP",
      timezone: "UTC",
      startDate: new Date("2026-08-18T00:00:00.000Z"),
    });
    mocks.findMany.mockResolvedValue([]);
    mocks.create.mockResolvedValue({ id: "event-1" });
  });

  it("authenticates and persists an event with no routine frequency", async () => {
    await expect(createEvent({
      title: "Release",
      startDate: "2026-08-20",
      duration: 3,
      timezone: "UTC",
      mode: "MANUAL",
      failurePolicy: "CONTINUE",
    })).resolves.toEqual({ id: "event-1" });

    expect(mocks.requireCurrentUser).toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "EVENT",
        frequency: null,
        eventMode: "MANUAL",
        eventDuration: 3,
        eventFailurePolicy: "CONTINUE",
      }),
    });
  });

  it("preserves automatic-event outcome restrictions for current and past days", async () => {
    await expect(setEventDayOutcome({
      taskId: "event-1",
      dateKey: "2026-08-20",
      outcome: "COMPLETED",
    })).rejects.toThrow("Automatic events only accept FAILED or null");
    expect(mocks.upsert).not.toHaveBeenCalled();

    await expect(setEventDayOutcome({
      taskId: "event-1",
      dateKey: "2026-08-20",
      outcome: "FAILED",
    })).resolves.toMatchObject({ taskId: "event-1", dateKey: "2026-08-20", outcome: "FAILED" });
    expect(mocks.upsert).toHaveBeenCalled();

    await expect(setEventDayOutcome({
      taskId: "event-1",
      dateKey: "2026-08-19",
      outcome: "COMPLETED",
    })).rejects.toThrow("Automatic events only accept FAILED or null");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    await expect(setEventDayOutcome({
      taskId: "event-1",
      dateKey: "2026-08-19",
      outcome: "FAILED",
    })).resolves.toMatchObject({ taskId: "event-1", dateKey: "2026-08-19", outcome: "FAILED" });
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });

  it("allows marking and clearing a past day", async () => {
    mocks.getOwnedEvent.mockResolvedValue({
      id: "event-1",
      type: "EVENT",
      eventMode: "MANUAL",
      eventDuration: 5,
      eventFailurePolicy: "CONTINUE",
      timezone: "UTC",
      startDate: new Date("2026-08-18T00:00:00.000Z"),
    });

    await expect(setEventDayOutcome({
      taskId: "event-1",
      dateKey: "2026-08-19",
      outcome: "COMPLETED",
    })).resolves.toMatchObject({ taskId: "event-1", dateKey: "2026-08-19", outcome: "COMPLETED" });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { taskId_date: { taskId: "event-1", date: new Date("2026-08-19T00:00:00.000Z") } },
      create: expect.objectContaining({ outcome: "COMPLETED" }),
    }));

    await expect(setEventDayOutcome({
      taskId: "event-1",
      dateKey: "2026-08-19",
      outcome: null,
    })).resolves.toMatchObject({ taskId: "event-1", dateKey: "2026-08-19", outcome: null });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "event-1", date: new Date("2026-08-19T00:00:00.000Z") },
    });
  });

  it("rejects future days without mutating marks", async () => {
    await expect(setEventDayOutcome({
      taskId: "event-1",
      dateKey: "2026-08-21",
      outcome: "FAILED",
    })).rejects.toThrow("future day");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects every mark for a day blocked by an earlier STOP failure", async () => {
    mocks.getOwnedEvent.mockResolvedValue({
      id: "event-1",
      type: "EVENT",
      eventMode: "MANUAL",
      eventDuration: 5,
      eventFailurePolicy: "STOP",
      timezone: "UTC",
      startDate: new Date("2026-08-18T00:00:00.000Z"),
      eventDayMarks: [{ date: new Date("2026-08-19T00:00:00.000Z"), outcome: "FAILED" }],
    });

    await expect(setEventDayOutcome({
      taskId: "event-1",
      dateKey: "2026-08-20",
      outcome: "COMPLETED",
    })).rejects.toThrow("blocked by an earlier failure");
    await expect(setEventDayOutcome({
      taskId: "event-1",
      dateKey: "2026-08-20",
      outcome: null,
    })).rejects.toThrow("blocked by an earlier failure");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("locks schedule and execution settings after an event starts or has marks", async () => {
    await expect(updateEvent({
      taskId: "event-1",
      title: "Release",
      startDate: "2026-08-18",
      duration: 6,
      timezone: "UTC",
      mode: "AUTOMATIC",
      failurePolicy: "STOP",
    })).rejects.toThrow("cannot change their schedule or execution settings");
    expect(mocks.update).not.toHaveBeenCalled();

    mocks.getOwnedEvent.mockResolvedValueOnce({
      id: "event-1",
      type: "EVENT",
      eventMode: "MANUAL",
      eventDuration: 5,
      eventFailurePolicy: "STOP",
      timezone: "UTC",
      startDate: new Date("2026-08-21T00:00:00.000Z"),
      eventDayMarks: [{ date: new Date("2026-08-19T00:00:00.000Z"), outcome: "COMPLETED" }],
    });
    await expect(updateEvent({
      taskId: "event-1",
      title: "Release",
      startDate: "2026-08-21",
      duration: 5,
      timezone: "America/New_York",
      mode: "MANUAL",
      failurePolicy: "STOP",
    })).rejects.toThrow("cannot change their schedule or execution settings");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
