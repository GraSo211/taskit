type DailyPoint = { dateKey: string; completed: boolean; scheduled: boolean };
type WeeklyDay = { dateKey: string; completed: boolean };

export type TaskHistory = {
  daily?: { startDate: string; endDate: string; points: DailyPoint[] };
  weekly?: { weekStart: string; weekEnd: string; completed: number; target: number; days: WeeklyDay[] };
};

type CompletionChartProps = { history?: TaskHistory; title: string; frequency: "DAILY" | "WEEKLY" };

export function CompletionChart({ history, title, frequency }: CompletionChartProps) {
  if (frequency === "DAILY" && history?.daily) return <DailyCompletionChart history={history.daily} title={title} />;
  if (frequency === "WEEKLY" && history?.weekly) return <WeeklyCompletionChart history={history.weekly} title={title} />;
  return null;
}

function DailyCompletionChart({ history, title }: { history: NonNullable<TaskHistory["daily"]>; title: string }) {
  const cells = Array.from({ length: 84 }, (_, index) => history.points[index] ?? null);
  return <section className="completion-chart daily-chart" aria-label={`Historial de ${title}`}>
    <div className="completion-chart-heading"><div><p className="chart-eyebrow">Últimas 12 semanas</p><h3 className="chart-title">Constancia</h3></div><span className="chart-range">{history.startDate} — {history.endDate}</span></div>
    <div className="chart-scroll"><div className="daily-grid" role="grid" aria-label={`Contribuciones de ${title}, de ${history.startDate} a ${history.endDate}`}>
      {cells.map((point, index) => point ? <span key={`${point.dateKey}-${index}`} className={`daily-cell ${point.completed ? "is-complete" : point.scheduled ? "is-pending" : "is-unscheduled"}`} role="gridcell" aria-label={`${point.dateKey}: ${point.completed ? "completada" : point.scheduled ? "programada, pendiente" : "no programada"}`} title={`${point.dateKey}: ${point.completed ? "completada" : point.scheduled ? "programada, pendiente" : "no programada"}`}>{point.completed ? "✓" : point.scheduled ? "•" : "–"}</span> : <span key={`empty-${index}`} className="daily-cell is-unavailable" aria-hidden="true" />)}
    </div></div>
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
