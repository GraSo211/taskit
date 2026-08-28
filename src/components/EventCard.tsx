import { EventGrid, type EventViewModel } from "./EventGrid";
import type { EventDayOutcome } from "@/lib/event-logic";

export function EventCard({ event, onEdit, onDelete, onOutcome }: { event: EventViewModel; onEdit: () => void; onDelete: () => void; onOutcome: (taskId: string, dateKey: string, outcome: EventDayOutcome | null) => void }) {
  const completed = event.days.filter((day) => day.status === "COMPLETED").length;
  const failed = event.days.filter((day) => day.status === "FAILED").length;
  const progress = Math.round((completed / event.duration) * 100);
  const status = failed ? "Con fallos" : completed === event.duration ? "Completado" : "En curso";
  return <article className="event-card">
    <header className="event-card-header"><div className="min-w-0"><p className="event-eyebrow">{event.mode === "MANUAL" ? "Manual" : "Automático"} · {event.failurePolicy === "STOP" ? "Termina ante fallo" : "Continúa ante fallo"}</p><h2>{event.title}</h2>{event.description && <p className="event-description">{event.description}</p>}</div><span className={`event-status event-status-${failed ? "failed" : completed === event.duration ? "completed" : "pending"}`}>{status}</span></header>
    <div className="event-progress"><div><span>{completed}/{event.duration} días</span><span>{progress}%</span></div><div className="event-progress-track"><span style={{ width: `${progress}%` }} /></div></div>
    <EventGrid event={event} onOutcome={onOutcome} />
    <div className="event-card-actions"><button type="button" className="ghost-link event-action" onClick={onEdit}>Editar</button><button type="button" className="ghost-link event-action event-delete" onClick={onDelete}>Eliminar</button></div>
  </article>;
}
