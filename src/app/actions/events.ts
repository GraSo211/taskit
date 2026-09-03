"use server";

import { revalidatePath } from "next/cache";

import { getOwnedEvent, requireCurrentUser } from "@/lib/dal";
import { projectEvent } from "@/lib/event-logic";
import { prisma } from "@/lib/prisma";
import { addDays, dateKeyToDbDate, dbDateToDateKey, localDateKey } from "@/lib/task-time";
import {
  createEventSchema,
  deleteEventSchema,
  eventDayMarkSchema,
  updateEventSchema,
} from "@/lib/task-validation";

function revalidateEventViews() {
  for (const path of ["/", "/dashboard", "/daily", "/weekly", "/projects", "/events"]) {
    revalidatePath(path);
  }
}

export async function createEvent(input: unknown) {
  const user = await requireCurrentUser();
  const data = createEventSchema.parse(input);
  const event = await prisma.task.create({
    data: {
      userId: user.id,
      type: "EVENT",
      frequency: null,
      targetCount: 1,
      scheduledWeekdays: [],
      title: data.title,
      description: data.description || null,
      reminderTime: data.reminderTime || null,
      timezone: data.timezone,
      startDate: dateKeyToDbDate(data.startDate),
      eventMode: data.mode,
      eventDuration: data.duration,
      eventFailurePolicy: data.failurePolicy,
    },
  });

  revalidateEventViews();
  return { id: event.id };
}

export async function updateEvent(input: unknown, values?: unknown) {
  const payload = values === undefined
    ? input
    : { ...(values as Record<string, unknown>), taskId: input };
  const data = updateEventSchema.parse(payload);
  const user = await requireCurrentUser();
  const event = await getOwnedEvent(data.taskId, user.id);
  if (!event) throw new Error("Event not found");

  const started = localDateKey(new Date(), event.timezone) >= dbDateToDateKey(event.startDate);
  const eventDayMarks = event.eventDayMarks ?? await prisma.eventDayMark.findMany({
    where: { taskId: event.id },
    orderBy: { date: "asc" },
  });
  const hasMarks = eventDayMarks.length > 0;
  const immutableFieldsChanged =
    data.startDate !== dbDateToDateKey(event.startDate) ||
    data.duration !== event.eventDuration ||
    data.timezone !== event.timezone ||
    data.mode !== event.eventMode ||
    data.failurePolicy !== event.eventFailurePolicy;
  if ((started || hasMarks) && immutableFieldsChanged) {
    throw new Error("Started or marked events cannot change their schedule or execution settings");
  }

  await prisma.task.update({
    where: { id: event.id },
    data: {
      type: "EVENT",
      frequency: null,
      targetCount: 1,
      scheduledWeekdays: [],
      title: data.title,
      description: data.description || null,
      reminderTime: data.reminderTime || null,
      timezone: data.timezone,
      startDate: dateKeyToDbDate(data.startDate),
      eventMode: data.mode,
      eventDuration: data.duration,
      eventFailurePolicy: data.failurePolicy,
    },
  });

  revalidateEventViews();
  return { id: event.id };
}

export async function deleteEvent(input: unknown) {
  const payload = typeof input === "string" ? { taskId: input } : input;
  const data = deleteEventSchema.parse(payload);
  const user = await requireCurrentUser();
  const event = await getOwnedEvent(data.taskId, user.id);
  if (!event) throw new Error("Event not found");

  await prisma.task.delete({ where: { id: event.id } });
  revalidateEventViews();
  return { id: event.id };
}

export async function setEventDayOutcome(input: unknown) {
  const data = eventDayMarkSchema.parse(input);
  const user = await requireCurrentUser();
  const event = await getOwnedEvent(data.taskId, user.id);
  if (!event) throw new Error("Event not found");
  if (!event.eventMode || !event.eventDuration || !event.eventFailurePolicy) {
    throw new Error("Event configuration is invalid");
  }

  const todayKey = localDateKey(new Date(), event.timezone);
  if (data.dateKey > todayKey) throw new Error("Event marks cannot be set for a future day");

  const startDateKey = dbDateToDateKey(event.startDate);
  const eventDuration = event.eventDuration;
  if (data.dateKey < startDateKey || data.dateKey >= addDays(startDateKey, eventDuration)) {
    throw new Error("Event day is outside the event range");
  }

  if (event.eventMode === "AUTOMATIC" && data.outcome !== null && data.outcome !== "FAILED") {
    throw new Error("Automatic events only accept FAILED or null");
  }

  const eventDayMarks = event.eventDayMarks ?? await prisma.eventDayMark.findMany({
    where: { taskId: event.id },
    orderBy: { date: "asc" },
  });

  const projection = projectEvent(
    {
      startDate: startDateKey,
      duration: eventDuration,
      timezone: event.timezone,
      mode: event.eventMode,
      failurePolicy: event.eventFailurePolicy,
    },
    eventDayMarks.map((mark) => ({ dateKey: mark.date, outcome: mark.outcome })),
    new Date(),
  );
  if (projection.days.find((day) => day.dateKey === data.dateKey)?.status === "BLOCKED") {
    throw new Error("Event day is blocked by an earlier failure");
  }

  const date = dateKeyToDbDate(data.dateKey);
  if (data.outcome === null) {
    await prisma.eventDayMark.deleteMany({ where: { taskId: event.id, date } });
  } else {
    await prisma.eventDayMark.upsert({
      where: { taskId_date: { taskId: event.id, date } },
      create: { taskId: event.id, date, outcome: data.outcome },
      update: { outcome: data.outcome },
    });
  }

  revalidateEventViews();
  return { taskId: event.id, dateKey: data.dateKey, outcome: data.outcome };
}

export const setEventDayMark = setEventDayOutcome;
export const markEventDay = setEventDayOutcome;

export async function completeEventDay(input: unknown) {
  return setEventDayOutcome({ ...(input as Record<string, unknown>), outcome: "COMPLETED" });
}

export async function failEventDay(input: unknown) {
  return setEventDayOutcome({ ...(input as Record<string, unknown>), outcome: "FAILED" });
}

export async function clearEventDayMark(input: unknown) {
  return setEventDayOutcome({ ...(input as Record<string, unknown>), outcome: null });
}
