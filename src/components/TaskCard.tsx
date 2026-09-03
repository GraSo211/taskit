import { IconCheck } from "./icons";
import { SubtaskList } from "./SubtaskList";
import type { Task } from "./types";

type TaskCardProps = { task: Task; onToggle?: (id: string) => void; onEdit?: () => void; disabled?: boolean; disabledReason?: string; onSubtaskToggle?: (subtaskId: string, completed: boolean) => Promise<void>; onSubtaskAdd?: (parentId: string | null, title: string) => Promise<void>; onSubtaskRename?: (subtaskId: string, title: string) => Promise<void>; onSubtaskDelete?: (subtaskId: string) => Promise<void>; onSubtaskMove?: (subtaskId: string, parentId: string | null, position: number) => Promise<void> };

export function TaskCard({ task, onToggle, onEdit, disabled = false, disabledReason, onSubtaskToggle, onSubtaskAdd, onSubtaskRename, onSubtaskDelete, onSubtaskMove }: TaskCardProps) {
  const isProject = task.type === "PROJECT";
  return <article className="task-card min-w-0 rounded-2xl border border-[#24242a] bg-[#0c0c0f] px-3 py-3 sm:px-5">
    <div className="flex items-center gap-3 sm:gap-4">
      {!isProject && <button type="button" onClick={() => onToggle?.(task.id)} disabled={disabled} aria-label={disabled ? `${task.title}: ${disabledReason || "no disponible"}` : task.done ? `Marcar ${task.title} como pendiente` : `Completar ${task.title}`} aria-pressed={task.done} title={disabled ? disabledReason : undefined} className={`grid size-11 shrink-0 place-items-center rounded-full border transition ${task.done ? "border-[#8052ff] bg-[#8052ff] text-white" : "border-[#888] text-transparent hover:border-white hover:bg-[#1a1725]"} disabled:cursor-not-allowed disabled:opacity-35`}><IconCheck className="size-4" /></button>}
      <div className="min-w-0 flex-1 py-2"><p className={`text-base leading-6 sm:text-lg ${task.done ? "text-[#a8a8a8] line-through" : "text-white"}`}>{task.title}</p>{task.note && <p className="mt-1 truncate text-sm leading-5 text-[#c0c0c0]">{task.note}</p>}</div>
      <div className="task-meta flex shrink-0 items-center gap-3">{task.tag && <span className="max-w-[7rem] text-right text-xs leading-4 text-[#ffb829] sm:max-w-none sm:text-sm">{task.tag}</span>}{task.time && <time className="shrink-0 text-sm text-[#c0c0c0]">{task.time}</time>}<button type="button" onClick={onEdit} className="ghost-link min-h-11 shrink-0 rounded-xl px-3 text-sm underline underline-offset-4 hover:bg-[#18151f]">Editar</button></div>
    </div>
    {isProject && task.subtasks && onSubtaskToggle && onSubtaskAdd && onSubtaskRename && onSubtaskDelete && onSubtaskMove && <SubtaskList taskId={task.id} taskTitle={task.title} subtasks={task.subtasks} onToggle={onSubtaskToggle} onAdd={onSubtaskAdd} onRename={onSubtaskRename} onDelete={onSubtaskDelete} onMove={onSubtaskMove} />}
  </article>;
}
