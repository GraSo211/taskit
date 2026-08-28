"use client";

import { TaskTree } from "./TaskTree";
import type { Subtask } from "./types";

type SubtaskListProps = { taskId: string; taskTitle: string; subtasks: Subtask[]; onToggle: (subtaskId: string, completed: boolean) => Promise<void>; onAdd: (parentId: string | null, title: string) => Promise<void>; onRename: (subtaskId: string, title: string) => Promise<void>; onDelete: (subtaskId: string) => Promise<void>; onMove: (subtaskId: string, parentId: string | null, position: number) => Promise<void> };

export function SubtaskList({ taskId, taskTitle, subtasks, onToggle, onAdd, onRename, onDelete, onMove }: SubtaskListProps) {
  return <div className="subtask-list mt-4 ml-2 border-l border-[#30283e] pl-3 sm:ml-16 sm:pl-4" aria-label={`Subtareas de ${taskTitle}`}><TaskTree taskId={taskId} taskTitle={taskTitle} subtasks={subtasks} onToggle={onToggle} onAdd={onAdd} onRename={onRename} onDelete={onDelete} onMove={onMove} /></div>;
}
