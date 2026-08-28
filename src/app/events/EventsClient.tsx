"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createEvent, deleteEvent, setEventDayOutcome, updateEvent } from "@/app/actions/events";
import { DashboardShell } from "@/components/DashboardShell";
import { EventCard } from "@/components/EventCard";
import { EventEditor } from "@/components/EventEditor";
import { EventStatusLegend } from "@/components/EventStatusLegend";
import type { EventDayOutcome } from "@/lib/event-logic";
import type { EventViewModel } from "@/components/EventGrid";
import { IconCalendar, IconHome } from "@/components/icons";
import { IconTarget } from "@/components/icons";
import { signOut } from "@/lib/auth-client";
import { nextLocalDateChange } from "@/lib/task-time";

type EventData = { user: { name: string; email: string }; events: EventViewModel[] };
type Filter = "ALL" | "ACTIVE" | "COMPLETED" | "FAILED";

export default function EventsClient({ data }: { data: EventData }) {
  const router = useRouter(); const [editor, setEditor] = useState<EventViewModel | "new" | null>(null); const [filter, setFilter] = useState<Filter>("ALL"); const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: number | undefined;
    const refreshAtLocalDateChange = () => {
      router.refresh();
      schedule();
    };
    const schedule = () => {
      const nextChange = data.events.reduce((soonest, event) => {
        const change = nextLocalDateChange(event.timezone);
        return change < soonest ? change : soonest;
      }, nextLocalDateChange(data.events[0]?.timezone ?? "UTC"));
      timer = window.setTimeout(refreshAtLocalDateChange, Math.max(250, nextChange.getTime() - Date.now() + 50));
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    schedule();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { if (timer !== undefined) window.clearTimeout(timer); window.removeEventListener("focus", refreshWhenVisible); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, [data.events, router]);
  const isActive = (event: EventViewModel) => event.days.some((day) => day.status === "PENDING" || day.status === "UPCOMING");
  const events = data.events.filter((event) => filter === "ALL" || filter === "ACTIVE" && isActive(event) || filter === "COMPLETED" && event.days.length > 0 && event.days.every((day) => day.status === "COMPLETED") || filter === "FAILED" && event.days.some((day) => day.status === "FAILED"));
  const navItems = [{ label: "Resumen", href: "/", active: false, icon: <IconHome className="size-5" /> }, { label: "Diarias", href: "/daily", active: false, icon: <IconCalendar className="size-5" /> }, { label: "Semanales", href: "/weekly", active: false, icon: <IconCalendar className="size-5" /> }, { label: "Proyectos", href: "/projects", active: false, icon: <IconTarget className="size-5" /> }, { label: "Eventos", href: "/events", active: true, icon: <IconCalendar className="size-5" /> }];
  function refresh() { setMessage(""); router.refresh(); }
  async function logout() { await signOut(); router.push("/inicio"); router.refresh(); }
  async function save(values: Record<string, unknown>) { if (editor && editor !== "new") await updateEvent(editor.id, values); else await createEvent(values); setEditor(null); refresh(); }
  async function remove(id: string) { if (!window.confirm("¿Eliminar este evento? Esta acción no se puede deshacer.")) return; try { await deleteEvent(id); refresh(); } catch { setMessage("No pudimos eliminar el evento. Inténtalo de nuevo."); } }
  async function mark(taskId: string, dateKey: string, outcome: EventDayOutcome | null) { try { await setEventDayOutcome({ taskId, dateKey, outcome }); refresh(); } catch { setMessage("Solo puedes actualizar el día actual en tu zona horaria."); } }
  return <DashboardShell userName={data.user.name} navItems={navItems} onCreate={() => setEditor("new")} onSignOut={logout} createLabel="Nuevo evento" heading="Eventos que toman forma" description="Sigue un recorrido día a día, con claridad sobre lo que viene después.">
    {message && <p className="mb-6 text-base text-[#ffb829]" role="alert">{message}</p>}
    <section aria-labelledby="events-title"><div className="event-section-heading"><div><p className="event-eyebrow">Tu calendario</p><h2 id="events-title" className="display-type mt-4 text-4xl text-white">Recorridos activos</h2><p className="mt-3 max-w-xl text-base leading-6 text-[#b8b8b8]">Cada cuadrado representa un día local de tu evento.</p></div><span className="event-count">{data.events.length} {data.events.length === 1 ? "evento" : "eventos"}</span></div>
      <div className="event-toolbar" role="group" aria-label="Filtrar eventos">{([ ["ALL", "Todos"], ["ACTIVE", "En curso"], ["COMPLETED", "Completados"], ["FAILED", "Con fallos"] ] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? "event-filter is-active" : "event-filter"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <EventStatusLegend /><div className="mt-8 space-y-5">{events.length ? events.map((event) => <EventCard key={event.id} event={event} onEdit={() => setEditor(event)} onDelete={() => void remove(event.id)} onOutcome={mark} />) : <p className="rounded-2xl border border-[#24242a] bg-[#0c0c0f] px-5 py-7 text-base text-[#b8b8b8]">{filter === "ALL" ? "Aún no tienes eventos. Crea el primero para empezar un recorrido." : "No hay eventos con este estado."}</p>}</div>
    </section>{editor && <EventEditor event={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={save} />}
  </DashboardShell>;
}
