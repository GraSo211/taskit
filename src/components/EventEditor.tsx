"use client";

import { useState, type FormEvent } from "react";
import type { EventViewModel } from "./EventGrid";
import type { EventFailurePolicy, EventMode } from "@/lib/event-logic";

type EventEditorProps = { event?: EventViewModel; onClose: () => void; onSave: (values: Record<string, unknown>) => Promise<void> };
export function EventEditor({ event, onClose, onSave }: EventEditorProps) {
  const [mode, setMode] = useState<EventMode>(event?.mode ?? "MANUAL");
  const [policy, setPolicy] = useState<EventFailurePolicy>(event?.failurePolicy ?? "STOP");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setBusy(true); setError(""); const form = new FormData(e.currentTarget); try { await onSave({ title: String(form.get("title")), description: String(form.get("description") || ""), startDate: String(form.get("startDate")), duration: Number(form.get("duration")), mode, failurePolicy: policy, timezone: event?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, type: "EVENT" }); } catch { setError("Revisa el título, la fecha y la duración."); } finally { setBusy(false); } }
  return <div className="event-editor fixed inset-0 z-50 overflow-y-auto bg-black/95 px-4 py-6 sm:px-6 sm:py-12" role="dialog" aria-modal="true" aria-labelledby="event-editor-title"><form className="mx-auto w-full max-w-xl" onSubmit={submit}><div className="flex items-start justify-between gap-4"><div><p className="event-eyebrow">{event ? "Editar evento" : "Nuevo evento"}</p><h2 id="event-editor-title" className="display-type mt-4 text-4xl text-white sm:text-5xl">{event ? "Ajusta el recorrido." : "Dale un comienzo."}</h2></div><button type="button" className="ghost-link min-h-11 shrink-0 rounded-xl px-3" onClick={onClose} aria-label="Cerrar editor">Cerrar</button></div>
    <label className="event-field">Nombre<input name="title" required defaultValue={event?.title} autoFocus /></label>
    <label className="event-field">Descripción <span>(opcional)</span><textarea name="description" rows={3} defaultValue={event?.description ?? ""} /></label>
    <div className="event-form-grid"><label className="event-field">Fecha de inicio<input name="startDate" type="date" required defaultValue={event?.startDate} /></label><label className="event-field">Duración <span>(días)</span><input name="duration" type="number" min={1} max={366} required defaultValue={event?.duration ?? 7} /></label></div>
    <fieldset className="event-fieldset"><legend>Cómo se registra</legend><label><input type="radio" checked={mode === "MANUAL"} onChange={() => setMode("MANUAL")} /> Manual <small>Decides cómo termina cada día.</small></label><label><input type="radio" checked={mode === "AUTOMATIC"} onChange={() => setMode("AUTOMATIC")} /> Automático <small>El día se cierra según su fecha local; puedes marcar un fallo o restaurarlo.</small></label></fieldset>
    <fieldset className="event-fieldset"><legend>Qué ocurre ante un fallo</legend><label><input type="radio" checked={policy === "CONTINUE"} onChange={() => setPolicy("CONTINUE")} /> Continuar <small>Los días siguientes permanecen disponibles.</small></label><label><input type="radio" checked={policy === "STOP"} onChange={() => setPolicy("STOP")} /> Terminar <small>Los días siguientes quedan bloqueados.</small></label></fieldset>
    {error && <p className="event-error" role="alert">{error}</p>}<div className="event-editor-actions"><button type="button" className="ghost-link event-action" onClick={onClose}>Cancelar</button><button type="submit" className="iris-button min-h-12 px-5 text-sm font-semibold uppercase tracking-[.08em]" disabled={busy}>{busy ? "Guardando…" : "Guardar evento"}</button></div>
  </form></div>;
}
