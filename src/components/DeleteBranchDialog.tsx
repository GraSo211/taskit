"use client";

import { useRef } from "react";
import { useDialogKeyboard } from "./useDialogKeyboard";

export function DeleteBranchDialog({ title, count, onCancel, onConfirm }: { title: string; count: number; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null); const { dialogRef, onKeyDown } = useDialogKeyboard<HTMLElement>(onCancel, cancelRef);
  return <div className="subtask-dialog-backdrop" role="presentation"><section ref={dialogRef} onKeyDown={onKeyDown} className="subtask-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-subtask-title" aria-describedby="delete-subtask-description"><p className="event-eyebrow">Eliminar rama</p><h2 id="delete-subtask-title">¿Eliminar «{title}»?</h2><p id="delete-subtask-description">También se eliminarán {count} {count === 1 ? "subtarea" : "subtareas"}. Esta acción no se puede deshacer.</p><div className="subtask-editor-actions"><button ref={cancelRef} type="button" className="ghost-link subtask-action" onClick={onCancel}>Cancelar</button><button type="button" className="subtask-danger subtask-action" onClick={onConfirm}>Eliminar rama</button></div></section></div>;
}
