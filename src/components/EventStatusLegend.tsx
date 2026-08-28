export function EventStatusLegend() {
  return <div className="event-legend" aria-label="Estados de los días"><span><i className="event-key event-key-pending">•</i>Pendiente</span><span><i className="event-key event-key-completed">✓</i>Completado</span><span><i className="event-key event-key-failed">!</i>Fallo</span><span><i className="event-key event-key-blocked">×</i>Bloqueado</span></div>;
}
