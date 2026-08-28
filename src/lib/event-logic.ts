import {
  addDays,
  dbDateToDateKey,
  localDateKey,
  type DateKey,
} from "./task-time";

export type EventMode = "MANUAL" | "AUTOMATIC";
export type EventFailurePolicy = "STOP" | "CONTINUE";
export type EventDayOutcome = "COMPLETED" | "FAILED";
export type EventDayStatus = "UPCOMING" | "PENDING" | "COMPLETED" | "FAILED" | "BLOCKED";

export type EventForProjection = {
  startDate: DateKey | Date;
  duration: number;
  timezone: string;
  mode: EventMode;
  failurePolicy: EventFailurePolicy;
};

export type EventDayMarkForProjection = {
  dateKey: DateKey | Date;
  outcome: EventDayOutcome;
};

export type ProjectedEventDay = {
  dateKey: DateKey;
  status: EventDayStatus;
  outcome: EventDayOutcome | null;
};

export type ProjectedEvent = {
  days: ProjectedEventDay[];
};

function toDateKey(value: DateKey | Date): DateKey {
  return typeof value === "string" ? value : dbDateToDateKey(value);
}

/**
 * Derives an event's complete timeline without touching persistence. Missing
 * historical marks are intentionally interpreted from the event mode.
 */
export function projectEvent(
  event: EventForProjection,
  marks: readonly EventDayMarkForProjection[] = [],
  now: Date | DateKey = new Date(),
): ProjectedEvent {
  const startDate = toDateKey(event.startDate);
  const todayKey = typeof now === "string" ? now : localDateKey(now, event.timezone);
  const markByDate = new Map(marks.map((mark) => [toDateKey(mark.dateKey), mark.outcome]));
  const days: ProjectedEventDay[] = [];
  let stopped = false;

  for (let index = 0; index < event.duration; index += 1) {
    const dateKey = addDays(startDate, index);
    if (stopped) {
      days.push({ dateKey, status: "BLOCKED", outcome: null });
      continue;
    }

    if (dateKey > todayKey) {
      days.push({ dateKey, status: "UPCOMING", outcome: null });
      continue;
    }

    const markedOutcome = markByDate.get(dateKey);
    const outcome = markedOutcome ?? (
      dateKey === todayKey ? null : event.mode === "MANUAL" ? "FAILED" : "COMPLETED"
    );
    const status: EventDayStatus = outcome ?? "PENDING";
    days.push({ dateKey, status, outcome });
    if (event.failurePolicy === "STOP" && status === "FAILED") stopped = true;
  }

  return { days };
}

export function projectEventDays(
  event: EventForProjection,
  marks: readonly EventDayMarkForProjection[] = [],
  now: Date | DateKey = new Date(),
): ProjectedEventDay[] {
  return projectEvent(event, marks, now).days;
}
