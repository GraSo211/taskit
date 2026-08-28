import type { EventDayStatus, EventMode, EventDayOutcome } from "@/lib/event-logic";
import { EventCell } from "./EventCell";

export type EventViewModel = { id: string; title: string; description: string | null; type: "EVENT"; mode: EventMode; duration: number; failurePolicy: "STOP" | "CONTINUE"; timezone: string; startDate: string; todayKey: string; days: Array<{ dateKey: string; status: EventDayStatus; outcome: EventDayOutcome | null }> };

function shortDate(dateKey: string) { return new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric" }).format(new Date(`${dateKey}T12:00:00`)).replace(".", ""); }

export function EventGrid({ event, onOutcome }: { event: EventViewModel; onOutcome: (taskId: string, dateKey: string, outcome: EventDayOutcome | null) => void }) {
  return <div className="event-grid-scroll" tabIndex={0} aria-label={`Cronograma de ${event.title}. Desliza horizontalmente para ver todos los días.`}>
    <div className="event-grid" role="grid" aria-label={`Días del evento ${event.title}`}>
      <div className="event-grid-corner" aria-hidden="true">Día</div>
      {event.days.map((day) => <div className="event-grid-date" role="columnheader" key={day.dateKey}>{shortDate(day.dateKey)}{day.dateKey === event.todayKey && <strong>Hoy</strong>}</div>)}
      <div className="event-grid-label" role="rowheader">{event.title}</div>
      {event.days.map((day) => <EventCell key={day.dateKey} taskId={event.id} todayKey={event.todayKey} mode={event.mode} {...day} onOutcome={onOutcome} />)}
    </div>
  </div>;
}
