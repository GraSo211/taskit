import { z } from "zod";

import { localDateKey, normalizeTimezone, validateDateKey } from "./task-time";

export const taskFrequencySchema = z.enum(["DAILY", "WEEKLY"]);
export const taskTypeSchema = z.enum(["ROUTINE", "PROJECT"]);
export const taskIdSchema = z.string().trim().min(1);

const scheduledWeekdaysSchema = z
  .array(z.coerce.number().int().min(0).max(6))
  .max(7)
  .default([])
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

const commonTaskFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
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
});

const subtaskInputSchema = z.object({
  id: taskIdSchema.optional(),
  title: z.string().trim().min(1).max(120),
});

const routineTaskSchema = commonTaskFieldsSchema.extend({
  type: z.literal("ROUTINE").default("ROUTINE"),
  frequency: taskFrequencySchema,
  targetCount: z.coerce.number().int().min(1).max(100),
  scheduledWeekdays: scheduledWeekdaysSchema,
});

const projectTaskFieldsSchema = commonTaskFieldsSchema.extend({
  type: z.literal("PROJECT"),
  // Accept routine-shaped form payloads too; PROJECT normalization always
  // clears this field before persistence.
  frequency: taskFrequencySchema.nullish(),
  targetCount: z.coerce.number().int().min(1).max(1).default(1),
  scheduledWeekdays: scheduledWeekdaysSchema,
  subtasks: z.array(subtaskInputSchema).min(1).max(100),
});

function withUniqueSubtaskIds<T extends typeof projectTaskFieldsSchema>(schema: T) {
  return schema.superRefine((task, context) => {
    const ids = task.subtasks.flatMap((subtask) => (subtask.id ? [subtask.id] : []));
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["subtasks"],
        message: "Subtask ids must be unique",
      });
    }
  });
}

const projectTaskSchema = withUniqueSubtaskIds(projectTaskFieldsSchema);
const projectTaskUpdateSchema = withUniqueSubtaskIds(
  projectTaskFieldsSchema.extend({ taskId: taskIdSchema }),
);

export const createTaskSchema = z.union([projectTaskSchema, routineTaskSchema]);
export const updateTaskSchema = z.union([projectTaskUpdateSchema, routineTaskSchema.extend({ taskId: taskIdSchema })]);

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

export const subtaskCompletionSchema = z.object({
  taskId: taskIdSchema,
  subtaskId: taskIdSchema,
  completed: z.boolean(),
});

export function normalizeTaskData<
  T extends z.output<typeof createTaskSchema> | z.output<typeof updateTaskSchema>,
>(data: T): T {
  if (data.type === "PROJECT") {
    return {
      ...data,
      frequency: null,
      targetCount: 1,
      scheduledWeekdays: [],
    } as T;
  }

  if (data.frequency === "WEEKLY") {
    return { ...data, scheduledWeekdays: [] } as T;
  }

  return { ...data, targetCount: 1 } as T;
}

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type ProjectSubtaskInput = z.output<typeof subtaskInputSchema>;
