type Routine = { title: string; frequency: "DAILY" | "WEEKLY"; history?: { daily?: { points: Array<{ dateKey: string; completed: boolean; scheduled: boolean }> }; weekly?: { completed: number; target: number; days: Array<{ dateKey: string; completed: boolean }> } } };

function label(dateKey: string) {
  return new Intl.DateTimeFormat("es", { weekday: "short" }).format(new Date(`${dateKey}T12:00:00`)).replace(".", "");
}

export function OverviewCharts({ tasks }: { tasks: Routine[] }) {
  const daily = tasks.filter((task) => task.frequency === "DAILY");
  const points = daily.flatMap((task) => task.history?.daily?.points ?? []);
  const dates = [...new Set(points.map((point) => point.dateKey))].slice(-7);
  const bars = dates.map((dateKey) => ({ dateKey, completed: points.filter((point) => point.dateKey === dateKey && point.completed).length, scheduled: points.filter((point) => point.dateKey === dateKey && point.scheduled).length }));
  const max = Math.max(1, ...bars.map((bar) => bar.scheduled));
  const weekly = tasks.filter((task) => task.frequency === "WEEKLY");
  const weeklyDone = weekly.reduce((total, task) => total + (task.history?.weekly?.days.filter((day) => day.completed).length ?? 0), 0);
  const weeklyTarget = weekly.reduce((total, task) => total + (task.history?.weekly?.target ?? 0), 0);

  return <section className="overview-charts" aria-labelledby="rhythm-title">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ffb829]">Señales de ritmo</p><h2 id="rhythm-title" className="display-type mt-4 text-4xl text-white">Tu semana, de un vistazo</h2></div><p className="text-sm text-[#888]">Datos de tus tareas activas</p></div>
    <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
      <div className="chart-panel" role="img" aria-label={`Constancia diaria: ${bars.map((bar) => `${label(bar.dateKey)} ${bar.completed} de ${bar.scheduled}`).join(", ") || "sin datos"}`}><div className="flex items-center justify-between"><div><h3 className="chart-title">Constancia diaria</h3><p className="chart-caption">Tareas completadas por día</p></div><span className="chart-stat">{bars.reduce((sum, bar) => sum + bar.completed, 0)} <small>hechas</small></span></div><div className="overview-bars" aria-hidden="true">{bars.length ? bars.map((bar) => <div className="overview-bar-column" key={bar.dateKey}><div className="overview-bar-track"><span style={{ height: `${Math.round((bar.completed / max) * 100)}%` }} /></div><span>{label(bar.dateKey)}</span></div>) : <p className="py-8 text-sm text-[#888]">Completa una tarea para empezar a ver tu ritmo.</p>}</div></div>
      <div className="chart-panel flex flex-col justify-between"><div><h3 className="chart-title">Metas semanales</h3><p className="chart-caption">Repeticiones cumplidas esta semana</p></div><div className="mt-8 flex items-baseline gap-2"><span className="display-type text-5xl text-white">{weeklyDone}</span><span className="text-[#888]">/ {weeklyTarget || 0}</span></div><div className="mt-5 h-2 rounded-full bg-[#2b2b31]" role="progressbar" aria-label="Metas semanales completadas" aria-valuemin={0} aria-valuemax={weeklyTarget || 1} aria-valuenow={weeklyDone}><span className="block h-2 rounded-full bg-[#ffb829]" style={{ width: `${weeklyTarget ? Math.min(100, (weeklyDone / weeklyTarget) * 100) : 0}%` }} /></div></div>
    </div>
  </section>;
}
