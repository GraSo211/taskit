import { describe, expect, it } from "vitest";

import { calculateProjectProgress, isProjectComplete } from "../src/lib/task-logic";
import {
  getSubtreeIds,
  planSubtaskMove,
  projectSubtaskTree,
  validateSubtaskRows,
} from "../src/lib/subtask-logic";

const rows = [
  { id: "root-a", taskId: "project", parentId: null, title: "A", position: 0, completed: false },
  { id: "root-b", taskId: "project", parentId: null, title: "B", position: 1, completed: true },
  { id: "leaf-a1", taskId: "project", parentId: "root-a", title: "A1", position: 0, completed: true },
  { id: "leaf-a2", taskId: "project", parentId: "root-a", title: "A2", position: 1, completed: false },
];

describe("hierarchical subtask logic", () => {
  it("projects a tree, counts leaves only, and derives parent completion", () => {
    const tree = projectSubtaskTree(rows);
    expect(tree).toMatchObject([
      {
        id: "root-a",
        completed: false,
        children: [{ id: "leaf-a1", completed: true }, { id: "leaf-a2", completed: false }],
      },
      { id: "root-b", completed: true, children: [] },
    ]);
    expect(calculateProjectProgress(tree)).toMatchObject({ completed: 2, target: 3, isComplete: false });
    expect(isProjectComplete(tree)).toBe(false);

    const completeTree = projectSubtaskTree(rows.map((row) => ({ ...row, completed: true })));
    expect(calculateProjectProgress(completeTree)).toMatchObject({ completed: 3, target: 3, isComplete: true });
    expect(isProjectComplete(completeTree)).toBe(true);
  });

  it("rejects cycles and missing parents while safely handling deep trees", () => {
    expect(() => validateSubtaskRows([
      { ...rows[0], parentId: "missing" },
    ])).toThrow("parent not found");
    expect(() => validateSubtaskRows([
      { ...rows[0], parentId: "root-a" },
    ])).toThrow("own parent");

    const deep = Array.from({ length: 9 }, (_, index) => ({
      id: `node-${index}`,
      taskId: "project",
      parentId: index === 0 ? null : `node-${index - 1}`,
      title: `Node ${index}`,
      position: 0,
      completed: false,
    }));
    expect(() => validateSubtaskRows(deep)).not.toThrow();
    expect(projectSubtaskTree(deep)).toHaveLength(1);
  });

  it("plans sibling-local moves and prevents moving into a descendant", () => {
    const plan = planSubtaskMove(rows, "leaf-a1", null, 0);
    expect(plan.parentId).toBeNull();
    expect([...plan.positions.entries()]).toEqual([
      ["leaf-a1", 0],
      ["root-a", 1],
      ["root-b", 2],
      ["leaf-a2", 0],
    ]);
    expect(getSubtreeIds(rows, "root-a")).toEqual(new Set(["root-a", "leaf-a1", "leaf-a2"]));

    expect(() => planSubtaskMove(rows, "root-a", "leaf-a1", 0)).toThrow("own subtree");
  });
});
