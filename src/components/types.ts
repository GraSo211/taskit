import type { ReactNode } from "react";

export type NavItem = { label: string; href: string; icon: ReactNode; active?: boolean; badge?: string };
export type TaskKind = "ROUTINE" | "PROJECT";
export type Subtask = { id: string; title: string; position: number; completed: boolean };
export type Task = { id: string; title: string; note?: string; time?: string; done?: boolean; tag?: string; type?: TaskKind; subtasks?: Subtask[] };
