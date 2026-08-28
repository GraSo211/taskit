"use client";

export function SubtaskActions({ canMoveUp, canMoveDown, onAdd, onEdit, onMoveUp, onMoveDown, onDelete }: { canMoveUp: boolean; canMoveDown: boolean; onAdd: () => void; onEdit: () => void; onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void }) {
  return <details className="subtask-actions"><summary className="subtask-more" aria-label="Más acciones">•••</summary><div className="subtask-menu"><button type="button" onClick={onAdd}>Añadir hijo</button><button type="button" onClick={onEdit}>Renombrar</button><button type="button" disabled={!canMoveUp} onClick={onMoveUp}>Mover arriba</button><button type="button" disabled={!canMoveDown} onClick={onMoveDown}>Mover abajo</button><button type="button" className="subtask-menu-danger" onClick={onDelete}>Eliminar rama</button></div></details>;
}
