"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createTask, setTaskCompletion, updateTask } from "@/app/actions/tasks";
import { signOut } from "@/lib/auth-client";
import { DashboardShell } from "@/components/DashboardShell";
import { ProgressCard } from "@/components/ProgressCard";
import { TaskCard } from "@/components/TaskCard";
import { IconCalendar, IconHome, IconTarget } from "@/components/icons";
import { localDateKey, nextLocalDateChange, normalizeTimeZone } from "@/lib/task-time";

type Progress = { completed: number; target: number; percentage: number; isComplete: boolean };
type DashboardTask = { id: string; title: string; description: string | null; frequency: "DAILY" | "WEEKLY"; targetCount: number; scheduledWeekdays: number[]; reminderTime: string | null; timezone: string; startDate: string; todayKey: string; completedToday: boolean; progress: { daily: Progress; weekly: Progress } };
type DashboardData = { user: { name: string; email: string }; clockSnapshots: Array<{ timezone: string; dateKey: string }>; progress: { daily: Progress; weekly: Progress }; tasks: DashboardTask[] };

const weekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function getInitialTimezone() {
  const timezone = typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    : "UTC";
  try {
    return normalizeTimeZone(timezone);
  } catch {
    return "UTC";
  }
}

function getNewTaskDate(timezone: string) {
  try {
    return localDateKey(new Date(), timezone);
  } catch {
    return localDateKey(new Date(), "UTC");
  }
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter(); const [isPending, startTransition] = useTransition(); const [editor, setEditor] = useState<DashboardTask | "new" | null>(null); const [message, setMessage] = useState("");
  useEffect(() => {
    if (!data.clockSnapshots.length) return;

    const now = new Date();
    const snapshots = data.clockSnapshots.reduce<Array<{ timezone: string; dateKey: string }>>((valid, snapshot) => {
      try {
        const timezone = normalizeTimeZone(snapshot.timezone);
        if (timezone) {
          localDateKey(now, timezone);
          if (!valid.some((item) => item.timezone === timezone)) valid.push({ timezone, dateKey: snapshot.dateKey });
        }
      } catch {
        // A bad timezone should not prevent the rest of the dashboard from working.
      }
      return valid;
    }, []);
    if (!snapshots.length) return;

    const refreshIfStale = () => {
      const now = new Date();
      const stale = snapshots.some((snapshot) => localDateKey(now, snapshot.timezone) !== snapshot.dateKey);
      if (stale) router.refresh();
      return stale;
    };
    if (refreshIfStale()) return;

    const onVisibilityChange = () => { if (document.visibilityState === "visible") refreshIfStale(); };
    const onFocus = () => refreshIfStale();
    const onPageShow = () => refreshIfStale();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    const nextChanges = snapshots.flatMap(({ timezone }) => {
      try {
        return [nextLocalDateChange(timezone)];
      } catch {
        return [];
      }
    });
    const earliestChange = nextChanges.length
      ? Math.min(...nextChanges.map((change) => change instanceof Date ? change.getTime() : change))
      : undefined;
    const timeoutId = earliestChange === undefined
      ? undefined
      : window.setTimeout(() => router.refresh(), Math.max(0, earliestChange - Date.now() + 150));
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [data.clockSnapshots, router]);
  const daily = data.tasks.filter((task) => task.frequency === "DAILY"); const weekly = data.tasks.filter((task) => task.frequency === "WEEKLY");
  function toggle(task: DashboardTask) { setMessage(""); startTransition(async () => { try { const result = await setTaskCompletion({ taskId: task.id, dateKey: task.todayKey, completed: !task.completedToday }) as { completed: boolean; stale?: true }; if (result.stale) router.refresh(); } catch { setMessage("No pudimos actualizar la tarea. Inténtalo de nuevo."); } }); }
  async function logout() { await signOut(); router.push("/"); router.refresh(); }
  return <DashboardShell userName={data.user.name} onCreate={() => setEditor("new")} onSignOut={logout} navItems={[{ label: "Resumen", href: "/dashboard", active: true, icon: <IconHome className="size-5" /> }, { label: "Rutinas", href: "#rutinas", icon: <IconCalendar className="size-5" /> }, { label: "Progreso", href: "#progreso", icon: <IconTarget className="size-5" /> }]}><section id="progreso" className="grid gap-10 border-b border-[#333] pb-16 sm:grid-cols-2 sm:gap-12 sm:pb-20"><ProgressCard label="Progreso diario" value={data.progress.daily.percentage} detail={`${data.progress.daily.completed}/${data.progress.daily.target}`} /><ProgressCard label="Progreso semanal" value={data.progress.weekly.percentage} detail={`${data.progress.weekly.completed}/${data.progress.weekly.target}`} tone="coral" /></section>{message && <p role="alert" className="mt-8 text-base text-[#ffb829]">{message}</p>}<section id="rutinas" className="mt-16 grid gap-16 xl:mt-20 xl:grid-cols-2 xl:gap-20"><TaskGroup title="Rutinas diarias" hint="Solo aparecen las tareas programadas para hoy" tasks={daily} onToggle={toggle} onEdit={setEditor} /><TaskGroup title="Metas semanales" hint="Repite cada semana" tasks={weekly} onToggle={toggle} onEdit={setEditor} /></section>{editor && <TaskEditor task={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); router.refresh(); }} />}{isPending && <p className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#15131b] px-4 py-3 text-sm text-[#ffb829]" role="status">Guardando…</p>}</DashboardShell>;
}

function TaskGroup({ title, hint, tasks, onToggle, onEdit }: { title: string; hint: string; tasks: DashboardTask[]; onToggle: (task: DashboardTask) => void; onEdit: (task: DashboardTask) => void }) { return <section><div className="mb-7 flex items-start justify-between gap-4 sm:items-end"><div><h2 className="display-type text-4xl text-white">{title}</h2><p className="mt-3 text-base leading-6 text-[#b8b8b8]">{hint}</p></div><span className="shrink-0 pt-1 text-right text-base text-[#a88dff]">{tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}</span></div><div className="space-y-3">{tasks.length ? tasks.map((task) => <TaskCard key={task.id} task={{ id: task.id, title: task.title, note: task.description || undefined, time: task.reminderTime || undefined, done: task.completedToday, tag: task.frequency === "DAILY" ? formatDays(task.scheduledWeekdays) : `${task.progress.weekly.completed}/${task.targetCount} sem.` }} onToggle={() => onToggle(task)} onEdit={() => onEdit(task)} />) : <p className="rounded-2xl border border-[#24242a] bg-[#0c0c0f] px-5 py-6 text-base text-[#b8b8b8]">No hay tareas programadas para hoy.</p>}</div></section>; }

function formatDays(days: number[]) { return days.length ? days.map((day) => weekdayLabels[day]).join(" · ") : "Todos los días"; }

function TaskEditor({ task, onClose, onSaved }: { task?: DashboardTask; onClose: () => void; onSaved: () => void }) {
  const [initialForm] = useState(() => { const initialTimezone = task?.timezone || getInitialTimezone(); return { timezone: initialTimezone, startDate: task ? task.startDate : getNewTaskDate(initialTimezone) }; });
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY">(task?.frequency || "DAILY"); const [days, setDays] = useState<number[]>(task?.scheduledWeekdays || []); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [timezone, setTimezone] = useState(initialForm.timezone);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, [busy, onClose]);
  const initialDate = initialForm.startDate;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const values = { title: String(form.get("title")), description: String(form.get("description") || ""), frequency, targetCount: frequency === "DAILY" ? 1 : Number(form.get("targetCount")), reminderTime: String(form.get("reminderTime") || "") || null, timezone: String(form.get("timezone") || "UTC"), startDate: String(form.get("startDate")), scheduledWeekdays: frequency === "DAILY" ? days : [] }; try { if (task) await updateTask(task.id, values); else await createTask(values); onSaved(); } catch { setError("No pudimos guardar la tarea. Revisa los datos e inténtalo de nuevo."); } finally { setBusy(false); } }
  function toggleDay(day: number) { setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => a - b)); }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/95 px-6 py-12" role="dialog" aria-modal="true" aria-labelledby="editor-title"><form onSubmit={submit} className="mx-auto w-full max-w-xl"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ffb829]">{task ? "Editar tarea" : "Nueva tarea"}</p><h2 id="editor-title" className="display-type mt-5 text-5xl text-white">{task ? "Ajusta tu ritmo." : "Un paso posible."}</h2></div><button type="button" onClick={onClose} className="min-h-11 min-w-11 text-3xl text-[#b8b8b8] hover:text-white" aria-label="Cerrar editor">×</button></div><label className="mt-12 block text-base text-[#d0d0d0]">Título<input ref={titleRef} name="title" required defaultValue={task?.title} className="mt-3 h-14 w-full rounded-xl border border-[#3b3b42] bg-[#0d0d10] px-4 text-lg text-white outline-none focus:border-[#8052ff] focus:ring-2 focus:ring-[#8052ff]/30" /></label><label className="mt-8 block text-base text-[#d0d0d0]">Descripción <span className="text-[#888]">(opcional)</span><textarea name="description" rows={2} defaultValue={task?.description || ""} className="mt-3 w-full resize-none rounded-xl border border-[#3b3b42] bg-[#0d0d10] px-4 py-3 text-base text-white outline-none focus:border-[#8052ff] focus:ring-2 focus:ring-[#8052ff]/30" /></label><fieldset className="mt-9"><legend className="text-base text-[#d0d0d0]">Frecuencia</legend><div className="mt-4 flex gap-7"><label className="flex min-h-11 items-center gap-2 text-base text-white"><input type="radio" checked={frequency === "DAILY"} onChange={() => setFrequency("DAILY")} className="size-5 accent-[#8052ff]" /> Cada día</label><label className="flex min-h-11 items-center gap-2 text-base text-white"><input type="radio" checked={frequency === "WEEKLY"} onChange={() => setFrequency("WEEKLY")} className="size-5 accent-[#8052ff]" /> Cada semana</label></div></fieldset>{frequency === "DAILY" ? <fieldset className="mt-9"><legend className="text-base text-[#d0d0d0]">Días programados</legend><p className="mt-2 text-sm text-[#b8b8b8]">{days.length ? "La tarea aparecerá solo estos días." : "Sin selección: todos los días."}</p><div className="mt-4 flex flex-wrap gap-2">{weekdayLabels.map((label, day) => <button type="button" key={label} aria-pressed={days.includes(day)} onClick={() => toggleDay(day)} className={`size-11 rounded-full text-sm font-semibold transition ${days.includes(day) ? "bg-[#8052ff] text-white" : "text-[#b8b8b8] hover:bg-[#17131f] hover:text-white"}`}>{label}</button>)}</div></fieldset> : <label className="mt-9 block text-base text-[#d0d0d0]">Veces por semana<select name="targetCount" defaultValue={task?.targetCount || 2} className="mt-3 block h-14 w-full rounded-xl border border-[#3b3b42] bg-[#0d0d10] px-4 text-white outline-none focus:border-[#8052ff]">{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? "vez" : "veces"}</option>)}</select></label>}<div className="mt-9 grid gap-8 sm:grid-cols-2"><label className="block text-base text-[#d0d0d0]">Recordatorio<input name="reminderTime" type="time" defaultValue={task?.reminderTime || ""} className="mt-3 h-14 w-full rounded-xl border border-[#3b3b42] bg-[#0d0d10] px-4 text-white outline-none focus:border-[#8052ff]" /></label><label className="block text-base text-[#d0d0d0]">Fecha de inicio<input name="startDate" type="date" required defaultValue={initialDate} className="mt-3 h-14 w-full rounded-xl border border-[#3b3b42] bg-[#0d0d10] px-4 text-white outline-none focus:border-[#8052ff]" /></label></div><label className="mt-8 block text-base text-[#d0d0d0]">Zona horaria<input name="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} className="mt-3 h-14 w-full rounded-xl border border-[#3b3b42] bg-[#0d0d10] px-4 text-white outline-none focus:border-[#8052ff]" /></label>{error && <p role="alert" className="mt-8 text-base text-[#ffb829]">{error}</p>}<div className="mt-12 flex items-center gap-7"><button type="submit" disabled={busy} className="iris-button min-h-14 px-7 text-sm font-semibold uppercase tracking-[.08em] disabled:cursor-wait disabled:opacity-50">{busy ? "Guardando…" : "Guardar tarea"}</button><button type="button" onClick={onClose} className="ghost-link min-h-11 px-2 text-base underline underline-offset-4">Cancelar</button></div></form></div>;
}
