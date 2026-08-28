"use client";

export function DeleteBranchDialog({ title, count, onCancel, onConfirm }: { title: string; count: number; onCancel: () => void; onConfirm: () => void }) {
  return <div className="subtask-dialog-backdrop" role="presentation"><section className="subtask-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-subtask-title" aria-describedby="delete-subtask-description"><p className="event-eyebrow">Eliminar rama</p><h2 id="delete-subtask-title">¿Eliminar «{title}»?</h2><p id="delete-subtask-description">También se eliminarán {count} {count === 1 ? "subtarea" : "subtareas"}. Esta acción no se puede deshacer.</p><div className="subtask-editor-actions"><button type="button" className="ghost-link subtask-action" autoFocus onClick={onCancel}>Cancelar</button><button type="button" className="subtask-danger subtask-action" onClick={onConfirm}>Eliminar rama</button></div></section></div>;
}
