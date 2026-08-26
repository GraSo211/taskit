import { z } from "zod";

import { localDateKey, normalizeTimezone, validateDateKey } from "./task-time";

export const taskFrequencySchema = z.enum(["DAILY", "WEEKLY"]);
export const taskIdSchema = z.string().trim().min(1);

const scheduledWeekdaysSchema = z
  .array(z.coerce.number().int().min(0).max(6))
  .max(7)
  .default([])
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

const taskFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  frequency: taskFrequencySchema,
  targetCount: z.coerce.number().int().min(1).max(100),
  reminderTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "reminderTime must use HH:mm")
    .optional()
    .nullable(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .transform(normalizeTimezone)
    .default("UTC"),
  startDate: z
    .string()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "startDate must use YYYY-MM-DD")
    .transform(validateDateKey)
    .default(() => localDateKey(new Date(), "UTC")),
  scheduledWeekdays: scheduledWeekdaysSchema,
});

export const createTaskSchema = taskFieldsSchema;
export const updateTaskSchema = taskFieldsSchema.extend({ taskId: taskIdSchema });
export const taskCompletionDateSchema = z.object({
  taskId: taskIdSchema,
  dateKey: z
    .string()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "dateKey must use YYYY-MM-DD")
    .transform(validateDateKey),
});
export const setTaskCompletionSchema = taskCompletionDateSchema.extend({
  completed: z.boolean(),
});

export function normalizeTaskData<T extends z.output<typeof taskFieldsSchema>>(data: T): T {
  if (data.frequency === "WEEKLY") {
    return { ...data, scheduledWeekdays: [] };
  }

  return { ...data, targetCount: 1 };
}

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
