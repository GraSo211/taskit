import type { NavItem } from "./types";
import { BrandMark } from "./BrandMark";
import { IconMenu } from "./icons";
import Link from "next/link";

type AppNavigationProps = { items: NavItem[]; profile?: { name: string; detail?: string; initials?: string }; onSignOut?: () => void };

export function AppNavigation({ items, profile, onSignOut }: AppNavigationProps) {
  return <><aside className="hidden w-64 shrink-0 px-8 py-9 lg:flex lg:flex-col" aria-label="Navegación principal"><BrandMark /><NavLinks items={items} /><div className="mt-auto space-y-4"><p className="truncate text-sm text-[#b8b8b8]">{profile?.name}</p><button type="button" onClick={onSignOut} className="ghost-link min-h-11 text-sm underline underline-offset-4">Cerrar sesión</button></div></aside><details className="mobile-navigation px-4 py-4 lg:hidden"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between"><BrandMark /><IconMenu className="size-6 text-[#b8b8b8]" /></summary><nav className="pt-5"><NavLinks items={items} /><button type="button" onClick={onSignOut} className="ghost-link mt-4 min-h-11 px-2 text-sm underline underline-offset-4">Cerrar sesión</button></nav></details></>;
}
function NavLinks({ items }: { items: NavItem[] }) { return <nav className="nav-links space-y-2">{items.map((item) => <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-2 text-base tracking-[.025em] transition ${item.active ? "bg-[#15131b] text-white" : "text-[#b8b8b8] hover:bg-[#0d0d10] hover:text-white"}`}>{item.icon}<span>{item.label}</span>{item.badge && <span className="ml-1 text-[#ffb829]">{item.badge}</span>}</Link>)}</nav>; }
