"use client";

import { useState } from "react";
import type { Subtask } from "./types";
import { TaskTreeNode } from "./TaskTreeNode";
import { DeleteBranchDialog } from "./DeleteBranchDialog";
import { SubtaskEditor } from "./SubtaskEditor";

type Props = { taskId: string; taskTitle: string; subtasks: Subtask[]; onToggle: (id: string, completed: boolean) => Promise<void>; onAdd: (parentId: string | null, title: string) => Promise<void>; onRename: (id: string, title: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onMove: (id: string, parentId: string | null, position: number) => Promise<void> };
export function TaskTree({ taskTitle, subtasks, onToggle, onAdd, onRename, onDelete, onMove }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null); const [deleteNode, setDeleteNode] = useState<Subtask | null>(null); const [flatAdd, setFlatAdd] = useState(false); const flat = subtasks;
  async function act(key: string, callback: () => Promise<void>) { setBusyId(key); try { await callback(); } finally { setBusyId(null); } }
  function leaves(node: Subtask): Subtask[] { return node.children.length ? node.children.flatMap(leaves) : [node]; }
  function toggle(node: Subtask, completed: boolean) { void act(node.id, () => onToggle(node.id, completed)); }
  function add(node: Subtask) { setBusyId(`add-${node.id}`); }
  function findSiblings(nodes: Subtask[], node: Subtask): Subtask[] { for (const current of nodes) { if (current.children.some((child) => child.id === node.id)) return current.children; const found = findSiblings(current.children, node); if (found.length) return found; } return flat; }
  function move(node: Subtask, direction: "up" | "down") { const siblings = findSiblings(flat, node); const index = siblings.findIndex((item) => item.id === node.id); const next = index + (direction === "up" ? -1 : 1); if (index >= 0 && next >= 0 && next < siblings.length) void act(node.id, () => onMove(node.id, node.parentId, next)); }
  const leafCount = flat.flatMap(leaves).length; const allNodes = flat.flatMap(flatten); const descendants = (node: Subtask): Set<string> => new Set(flatten(node).map((item) => item.id));
  function changeParent(node: Subtask, parentId: string | null) { if (parentId && (parentId === node.id || descendants(node).has(parentId))) return; void act(`parent-${node.id}`, () => onMove(node.id, parentId, 0)); }
  return <div className="task-tree-wrap"><div className="task-tree-summary"><span>Subtareas</span><span>{leafCount ? "Las hojas cuentan para el progreso" : "Añade el primer paso"}</span></div>{flatAdd && <SubtaskEditor label="Añadir subtarea al proyecto" onCancel={() => setFlatAdd(false)} onSave={(title) => act("add-root", async () => { await onAdd(null, title); setFlatAdd(false); })} />}<ul className="task-tree" aria-label={`Subtareas de ${taskTitle}`}>{subtasks.map((node, index) => <TaskTreeNode key={node.id} node={node} level={1} siblingIndex={index} siblingCount={subtasks.length} busyId={busyId} parentOptions={allNodes} onToggle={toggle} onAdd={add} onAddSubmit={(node, title) => act(`add-${node.id}`, () => onAdd(node.id, title))} onRename={(node, title) => act(`edit-${node.id}`, () => onRename(node.id, title))} onEdit={(node) => setBusyId(`edit-${node.id}`)} onCancelEdit={() => setBusyId(null)} onCancelAdd={() => setBusyId(null)} onDelete={setDeleteNode} onMove={move} onChangeParent={changeParent} />)}</ul><button type="button" className="subtask-add-root" onClick={() => setFlatAdd(true)}>+ Añadir subtarea</button>{deleteNode && <DeleteBranchDialog title={deleteNode.title} count={leaves(deleteNode).length} onCancel={() => setDeleteNode(null)} onConfirm={() => { void act(deleteNode.id, async () => { await onDelete(deleteNode.id); setDeleteNode(null); }); }} />}</div>;
}
function flatten(node: Subtask): Subtask[] { return [node, ...node.children.flatMap(flatten)]; }
