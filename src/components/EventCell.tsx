import type { EventDayStatus, EventMode, EventDayOutcome } from "@/lib/event-logic";

type EventCellProps = {
  taskId: string;
  dateKey: string;
  todayKey: string;
  status: EventDayStatus;
  outcome: EventDayOutcome | null;
  mode: EventMode;
  onOutcome: (taskId: string, dateKey: string, outcome: EventDayOutcome | null) => void;
};

const statusText: Record<EventDayStatus, string> = { UPCOMING: "próximo", PENDING: "pendiente", COMPLETED: "completado", FAILED: "fallo", BLOCKED: "bloqueado" };

export function EventCell({ taskId, dateKey, todayKey, status, outcome, mode, onOutcome }: EventCellProps) {
  const isToday = dateKey === todayKey;
  const canEdit = isToday && (status === "PENDING" || status === "COMPLETED" || status === "FAILED");
  const automatic = mode === "AUTOMATIC";
  const label = `${dateKey}: ${statusText[status]}${isToday ? ", hoy" : ""}`;
  if (!canEdit) return <span className={`event-cell event-cell-${status.toLowerCase()}`} role="gridcell" aria-label={label} title={label}>{status === "COMPLETED" ? "✓" : status === "FAILED" ? "!" : status === "BLOCKED" ? "×" : status === "PENDING" ? "•" : ""}</span>;
  if (automatic) return <button type="button" className={`event-cell event-cell-${status.toLowerCase()}`} aria-label={`${label}. ${status === "FAILED" ? "Restaurar día" : "Marcar fallo"}`} title={status === "FAILED" ? "Restaurar día" : "Marcar fallo"} onClick={() => onOutcome(taskId, dateKey, status === "FAILED" ? null : "FAILED")}>{status === "FAILED" ? "!" : "•"}</button>;
  return <span className={`event-cell-actions event-cell-${status.toLowerCase()}`} role="gridcell" aria-label={label}>
    <button type="button" aria-label={`Completar ${dateKey}`} title="Completar" onClick={() => onOutcome(taskId, dateKey, outcome === "COMPLETED" ? null : "COMPLETED")}>{status === "COMPLETED" ? "✓" : "✓"}</button>
    <button type="button" aria-label={`Marcar fallo el ${dateKey}`} title="Marcar fallo" onClick={() => onOutcome(taskId, dateKey, outcome === "FAILED" ? null : "FAILED")}>!</button>
  </span>;
}
