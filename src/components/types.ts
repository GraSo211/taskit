import type { ReactNode } from "react";

export type NavItem = { label: string; href: string; icon: ReactNode; active?: boolean; badge?: string };
export type Task = { id: string; title: string; note?: string; time?: string; done?: boolean; tag?: string };
