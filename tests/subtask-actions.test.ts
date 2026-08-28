import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  getOwnedProjectTask: vi.fn(),
  getOwnedSubtask: vi.fn(),
  taskUpdate: vi.fn(),
  subtaskFindMany: vi.fn(),
  subtaskUpdate: vi.fn(),
  subtaskCreate: vi.fn(),
  subtaskDeleteMany: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/dal", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
  getOwnedProjectTask: mocks.getOwnedProjectTask,
  getOwnedSubtask: mocks.getOwnedSubtask,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { update: mocks.taskUpdate },
    taskSubtask: {
      update: mocks.subtaskUpdate,
      findMany: mocks.subtaskFindMany,
      create: mocks.subtaskCreate,
      deleteMany: mocks.subtaskDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

const { addSubtask, moveSubtask, setSubtaskCompletion } = await import("../src/app/actions/tasks");

const project = { id: "project-1", type: "PROJECT", subtasks: [] };
const treeRows = [
  { id: "root-1", taskId: "project-1", parentId: null, title: "Root", position: 0, completed: false },
  { id: "child-1", taskId: "project-1", parentId: "root-1", title: "Child", position: 0, completed: false },
];

describe("hierarchical subtask actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.getOwnedProjectTask.mockResolvedValue(project);
    mocks.getOwnedSubtask.mockResolvedValue(treeRows[1]);
    mocks.subtaskFindMany.mockResolvedValue(treeRows);
    mocks.subtaskCreate.mockResolvedValue({
      id: "child-2", taskId: "project-1", parentId: "root-1", title: "New", position: 1, completed: false,
    });
    mocks.transaction.mockImplementation(async (callback) => callback({
      task: { update: mocks.taskUpdate },
      taskSubtask: {
        findMany: mocks.subtaskFindMany,
        update: mocks.subtaskUpdate,
        create: mocks.subtaskCreate,
        deleteMany: mocks.subtaskDeleteMany,
      },
    }));
  });

  it("toggles a parent subtree and derives project completion from roots", async () => {
    await expect(setSubtaskCompletion({ taskId: "project-1", subtaskId: "root-1", completed: true }))
      .resolves.toEqual({ completed: true, projectCompleted: true });
    expect(mocks.subtaskUpdate).toHaveBeenCalledWith({ where: { id: "root-1" }, data: { completed: true } });
    expect(mocks.subtaskUpdate).toHaveBeenCalledWith({ where: { id: "child-1" }, data: { completed: true } });
    expect(mocks.taskUpdate).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { completed: true },
    });
  });

  it("adds children with local positions and uses ownership-scoped project access", async () => {
    await expect(addSubtask({ taskId: "project-1", parentId: "root-1", title: "New" }))
      .resolves.toEqual({ id: "child-2" });
    expect(mocks.getOwnedProjectTask).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.subtaskCreate).toHaveBeenCalledWith({
      data: { taskId: "project-1", parentId: "root-1", title: "New", position: 1 },
    });
  });

  it("rejects cycles before mutating a move", async () => {
    await expect(moveSubtask({
      taskId: "project-1", subtaskId: "root-1", parentId: "child-1", position: 0,
    })).rejects.toThrow("own subtree");
    expect(mocks.subtaskUpdate).not.toHaveBeenCalled();
  });

  it("retries serializable transactions after a P2034 conflict", async () => {
    const conflict = Object.assign(new Error("serialization conflict"), { code: "P2034" });
    mocks.transaction
      .mockReset()
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async (callback) => callback({
        task: { update: mocks.taskUpdate },
        taskSubtask: {
          findMany: mocks.subtaskFindMany,
          update: mocks.subtaskUpdate,
          create: mocks.subtaskCreate,
          deleteMany: mocks.subtaskDeleteMany,
        },
      }));

    await expect(addSubtask({ taskId: "project-1", parentId: "root-1", title: "Retry" }))
      .resolves.toEqual({ id: "child-2" });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: "Serializable" });
  });
});
