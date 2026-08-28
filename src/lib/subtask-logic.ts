export type SubtaskRow = {
  id: string;
  taskId?: string;
  parentId?: string | null;
  title: string;
  position: number;
  completed: boolean;
};

export type SubtaskTreeNode = {
  id: string;
  parentId: string | null;
  title: string;
  position: number;
  completed: boolean;
  children: SubtaskTreeNode[];
};

function rowParentId(row: Pick<SubtaskRow, "parentId">) {
  return row.parentId ?? null;
}

function parentKey(parentId: string | null) {
  return parentId ?? "__root__";
}

function sortedRows(rows: readonly SubtaskRow[]) {
  return [...rows].sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
}

export function validateSubtaskRows(rows: readonly SubtaskRow[]): void {
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (byId.size !== rows.length) throw new Error("Subtask ids must be unique");

  for (const row of rows) {
    const parentId = rowParentId(row);
    if (parentId !== null && !byId.has(parentId)) {
      throw new Error("Subtask parent not found");
    }
    if (parentId === row.id) throw new Error("A subtask cannot be its own parent");
  }

  const state = new Map<string, "visiting" | "visited">();
  for (const start of rows) {
    if (state.get(start.id) === "visited") continue;
    const path: string[] = [];
    let current: string | null = start.id;
    while (current !== null && state.get(current) !== "visited") {
      if (state.get(current) === "visiting") throw new Error("Subtask cycle detected");
      state.set(current, "visiting");
      path.push(current);
      current = rowParentId(byId.get(current) ?? { parentId: null });
    }
    for (const id of path.reverse()) state.set(id, "visited");
  }
}

export function deriveSubtaskCompletion(rows: readonly SubtaskRow[]): Map<string, boolean> {
  validateSubtaskRows(rows);
  const childrenByParent = new Map<string, SubtaskRow[]>();
  for (const row of rows) {
    const parentId = rowParentId(row);
    if (parentId !== null) {
      const children = childrenByParent.get(parentId) ?? [];
      children.push(row);
      childrenByParent.set(parentId, children);
    }
  }

  const result = new Map<string, boolean>();
  const order: SubtaskRow[] = [];
  const pending = rows.filter((row) => rowParentId(row) === null);
  while (pending.length) {
    const row = pending.pop();
    if (!row) continue;
    order.push(row);
    pending.push(...(childrenByParent.get(row.id) ?? []));
  }
  for (const row of order.reverse()) {
    const children = childrenByParent.get(row.id) ?? [];
    result.set(row.id, children.length
      ? children.every((child) => result.get(child.id) === true)
      : row.completed);
  }
  return result;
}

export function projectSubtaskTree(rows: readonly SubtaskRow[]): SubtaskTreeNode[] {
  validateSubtaskRows(rows);
  const childrenByParent = new Map<string | null, SubtaskRow[]>();
  for (const row of rows) {
    const parentId = rowParentId(row);
    const children = childrenByParent.get(parentId) ?? [];
    children.push(row);
    childrenByParent.set(parentId, children);
  }
  const completion = deriveSubtaskCompletion(rows);

  const nodeById = new Map<string, SubtaskTreeNode>();
  for (const row of rows) {
    nodeById.set(row.id, {
      id: row.id,
      parentId: rowParentId(row),
      title: row.title,
      position: row.position,
      completed: completion.get(row.id) ?? row.completed,
      children: [],
    });
  }
  const roots: SubtaskTreeNode[] = [];
  for (const row of rows) {
    const node = nodeById.get(row.id);
    if (!node) continue;
    const parentId = rowParentId(row);
    if (parentId === null) roots.push(node);
    else nodeById.get(parentId)?.children.push(node);
  }
  const sortChildren = (nodes: SubtaskTreeNode[]) => {
    const pending = [...nodes];
    while (pending.length) {
      const node = pending.pop();
      if (!node) continue;
      node.children.sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
      pending.push(...node.children);
    }
    nodes.sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
  };
  sortChildren(roots);
  return roots;
}

export function getSubtaskDepths(rows: readonly SubtaskRow[]): Map<string, number> {
  validateSubtaskRows(rows);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const depths = new Map<string, number>();
  for (const start of rows) {
    if (depths.has(start.id)) continue;
    const path: string[] = [];
    let current: string | null = start.id;
    while (current !== null && !depths.has(current)) {
      path.push(current);
      current = rowParentId(byId.get(current) ?? { parentId: null });
    }
    let depth = current === null ? 1 : (depths.get(current) ?? 1) + 1;
    for (const id of path.reverse()) {
      depths.set(id, depth);
      depth += 1;
    }
  }
  return depths;
}

export function getSubtreeIds(rows: readonly SubtaskRow[], rootId: string): Set<string> {
  validateSubtaskRows(rows);
  const childrenByParent = new Map<string, string[]>();
  for (const row of rows) {
    const parentId = rowParentId(row);
    if (parentId !== null) {
      const children = childrenByParent.get(parentId) ?? [];
      children.push(row.id);
      childrenByParent.set(parentId, children);
    }
  }
  const result = new Set<string>();
  const pending = [rootId];
  while (pending.length) {
    const id = pending.pop();
    if (!id || result.has(id)) continue;
    result.add(id);
    pending.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

export function planSubtaskMove(
  rows: readonly SubtaskRow[],
  subtaskId: string,
  destinationParentId: string | null,
  destinationPosition: number,
) {
  validateSubtaskRows(rows);
  const node = rows.find((row) => row.id === subtaskId);
  if (!node) throw new Error("Subtask not found");
  if (destinationParentId !== null && !rows.some((row) => row.id === destinationParentId)) {
    throw new Error("Subtask parent not found");
  }

  const subtree = getSubtreeIds(rows, subtaskId);
  if (destinationParentId !== null && subtree.has(destinationParentId)) {
    throw new Error("A subtask cannot be moved into its own subtree");
  }

  const siblings = new Map<string, SubtaskRow[]>();
  for (const row of rows) {
    if (subtree.has(row.id)) continue;
    const key = parentKey(rowParentId(row));
    const list = siblings.get(key) ?? [];
    list.push(row);
    siblings.set(key, list);
  }
  for (const [key, list] of siblings) siblings.set(key, sortedRows(list));
  const destinationKey = parentKey(destinationParentId);
  const destinationSiblings = siblings.get(destinationKey) ?? [];
  if (!Number.isInteger(destinationPosition) || destinationPosition < 0 || destinationPosition > destinationSiblings.length) {
    throw new Error("Subtask position is out of range");
  }
  destinationSiblings.splice(destinationPosition, 0, node);
  siblings.set(destinationKey, destinationSiblings);

  const positions = new Map<string, number>();
  for (const list of siblings.values()) {
    for (const [position, row] of list.entries()) positions.set(row.id, position);
  }
  return { parentId: destinationParentId, positions };
}
