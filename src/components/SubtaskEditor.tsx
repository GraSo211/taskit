"use client";

import { useState, type FormEvent } from "react";

export function SubtaskEditor({ initialTitle = "", label, onCancel, onSave }: { initialTitle?: string; label: string; onCancel: () => void; onSave: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState(initialTitle); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (!title.trim()) { setError("Escribe un título."); return; } setBusy(true); setError(""); try { await onSave(title.trim()); } catch { setError("No pudimos guardar la subtarea."); } finally { setBusy(false); } }
  return <form className="subtask-editor" onSubmit={submit} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onCancel(); } }} aria-label={label}><label><span>{label}</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>{error && <p className="subtask-error" role="alert">{error}</p>}<div className="subtask-editor-actions"><button type="button" className="ghost-link subtask-action" onClick={onCancel}>Cancelar</button><button type="submit" className="iris-button subtask-action" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button></div></form>;
}
