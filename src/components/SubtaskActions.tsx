"use client";

import type { KeyboardEvent } from "react";

export function SubtaskActions({ canMoveUp, canMoveDown, onAdd, onEdit, onMoveUp, onMoveDown, onDelete }: { canMoveUp: boolean; canMoveDown: boolean; onAdd: () => void; onEdit: () => void; onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void }) {
  function closeOnEscape(event: KeyboardEvent<HTMLDetailsElement>) { if (event.key === "Escape") { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector<HTMLElement>("summary")?.focus(); } }
  return <details className="subtask-actions" onKeyDown={closeOnEscape}><summary className="subtask-more" aria-label="Acciones de la subtarea">Acciones</summary><div className="subtask-menu"><button type="button" onClick={onAdd}>Añadir hija</button><button type="button" onClick={onEdit}>Renombrar</button><button type="button" disabled={!canMoveUp} onClick={onMoveUp}>Mover arriba</button><button type="button" disabled={!canMoveDown} onClick={onMoveDown}>Mover abajo</button><button type="button" className="subtask-menu-danger" onClick={onDelete}>Eliminar rama</button></div></details>;
}
