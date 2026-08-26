type DailyPoint = { dateKey: string; completed: boolean; scheduled: boolean };
type WeeklyDay = { dateKey: string; completed: boolean };

export type DailyGridCell = { dateKey: string; point?: DailyPoint; column: number; row: number };

export type TaskHistory = {
  daily?: { startDate: string; endDate: string; points: DailyPoint[] };
  weekly?: { weekStart: string; weekEnd: string; completed: number; target: number; days: WeeklyDay[] };
};

const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Pure layout helper: calendar columns start on Sunday and the final data point stays in its local-date cell. */
export function buildDailyCalendarGrid(points: DailyPoint[], weeks = 12): DailyGridCell[] {
  const lastPoint = points[points.length - 1];
  if (!lastPoint || weeks < 1) return [];

  const lastDate = parseDateKey(lastPoint.dateKey);
  const lastSunday = addDays(lastDate, -lastDate.getUTCDay());
  const firstSunday = addDays(lastSunday, -(weeks - 1) * 7);
  const pointsByDate = new Map(points.map((point) => [point.dateKey, point]));

  return Array.from({ length: weeks * 7 }, (_, index) => {
    const column = Math.floor(index / 7);
    const row = index % 7;
    const dateKey = dateKeyFromDate(addDays(firstSunday, column * 7 + row));
    return { dateKey, point: pointsByDate.get(dateKey), column, row };
  });
}

type CompletionChartProps = { history?: TaskHistory; title: string; frequency: "DAILY" | "WEEKLY" };

export function CompletionChart({ history, title, frequency }: CompletionChartProps) {
  if (frequency === "DAILY" && history?.daily) return <DailyCompletionChart history={history.daily} title={title} />;
  if (frequency === "WEEKLY" && history?.weekly) return <WeeklyCompletionChart history={history.weekly} title={title} />;
  return null;
}

function DailyCompletionChart({ history, title }: { history: NonNullable<TaskHistory["daily"]>; title: string }) {
  const cells = buildDailyCalendarGrid(history.points);
  return <section className="completion-chart daily-chart" aria-label={`Historial de ${title}`}>
    <div className="completion-chart-heading"><div><p className="chart-eyebrow">Últimas 12 semanas</p><h3 className="chart-title">Constancia</h3></div><span className="chart-range">{history.startDate} — {history.endDate}</span></div>
    <div className="chart-scroll"><div className="daily-grid-layout"><div className="daily-day-labels" aria-hidden="true">{dayLabels.map((day) => <span key={day}>{day}</span>)}</div><div className="daily-grid" role="grid" aria-label={`Contribuciones de ${title}, semanas de domingo a sábado, de ${history.startDate} a ${history.endDate}`}>
      {cells.map((cell) => { const point = cell.point; const status = point ? point.completed ? "completada" : point.scheduled ? "programada, pendiente" : "no programada" : "fuera del rango disponible"; return <span key={cell.dateKey} className={`daily-cell ${point ? point.completed ? "is-complete" : point.scheduled ? "is-pending" : "is-unscheduled" : "is-unavailable"}`} role="gridcell" aria-label={`${cell.dateKey}: ${status}`} title={`${cell.dateKey}: ${status}`}>{point ? point.completed ? "✓" : point.scheduled ? "•" : "–" : ""}</span>; })}
    </div></div></div>
    <div className="chart-legend" aria-label="Leyenda del historial"><span><i className="legend-mark is-complete">✓</i> Completada</span><span><i className="legend-mark is-pending">•</i> Pendiente</span><span><i className="legend-mark is-unscheduled">–</i> No programada</span></div>
  </section>;
}

function WeeklyCompletionChart({ history, title }: { history: NonNullable<TaskHistory["weekly"]>; title: string }) {
  return <section className="completion-chart weekly-chart" aria-label={`Progreso semanal de ${title}`}>
    <div className="completion-chart-heading"><div><p className="chart-eyebrow">Semana del {history.weekStart}</p><h3 className="chart-title">Ritmo semanal</h3></div><strong className="weekly-total">{history.completed}<span>/{history.target}</span></strong></div>
    <div className="weekly-bars" role="list" aria-label={`Días de la semana de ${title}`}>
      {history.days.map((day, index) => <div className="weekly-day" key={`${day.dateKey}-${index}`} role="listitem" aria-label={`${day.dateKey}: ${day.completed ? "completado" : "pendiente"}`} title={`${day.dateKey}: ${day.completed ? "completado" : "pendiente"}`}><div className={`weekly-bar ${day.completed ? "is-complete" : "is-pending"}`}><span aria-hidden="true">{day.completed ? "✓" : "–"}</span></div><span className="weekly-day-label">{day.dateKey.slice(5)}</span></div>)}
    </div>
    <p className="chart-caption">{history.completed} de {history.target} repeticiones · termina el {history.weekEnd}</p>
  </section>;
}
