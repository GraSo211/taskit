"use client";

import { useState } from "react";
import { IconCheck } from "./icons";
import type { Subtask } from "./types";

type SubtaskListProps = {
  taskTitle: string;
  subtasks: Subtask[];
  onToggle: (subtaskId: string, completed: boolean) => Promise<void>;
};

export function SubtaskList({ taskTitle, subtasks, onToggle }: SubtaskListProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const completed = subtasks.filter((subtask) => subtask.completed).length;

  async function toggle(subtask: Subtask) {
    setPendingId(subtask.id);
    try { await onToggle(subtask.id, !subtask.completed); } finally { setPendingId(null); }
  }

  return <div className="subtask-list mt-4 ml-2 border-l border-[#30283e] pl-3 sm:ml-16 sm:pl-4" aria-label={`Subtareas de ${taskTitle}`}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#a88dff]">Subtareas <span className="text-[#777]">{completed}/{subtasks.length}</span></p>
      <span className="text-xs text-[#777]">{completed === subtasks.length ? "Completado" : "En curso"}</span>
    </div>
    <ul className="mt-2 space-y-1">
      {subtasks.map((subtask) => <li key={subtask.id}>
        <button type="button" disabled={pendingId !== null} onClick={() => void toggle(subtask)} aria-pressed={subtask.completed} aria-busy={pendingId === subtask.id} className="group flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-[#d0d0d0] transition hover:bg-[#111016] disabled:cursor-wait disabled:opacity-60">
          <span className={`grid size-5 shrink-0 place-items-center rounded-full border transition ${subtask.completed ? "border-[#8052ff] bg-[#8052ff] text-white" : "border-[#67616f] text-transparent group-hover:border-white"}`}><IconCheck className="size-3" /></span>
          <span className={subtask.completed ? "text-[#888] line-through" : ""}>{subtask.title}</span>
        </button>
      </li>)}
    </ul>
  </div>;
}
