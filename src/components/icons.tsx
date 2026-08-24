import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function IconCheck({ className, ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true" {...props}><path d="m5 12 4 4L19 6" /></svg>;
}
export function IconHome({ className, ...props }: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true" {...props}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-7h6v7"/></svg>; }
export function IconCalendar({ className, ...props }: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true" {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>; }
export function IconTarget({ className, ...props }: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true" {...props}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="m16 8 4-4M17 4h3v3"/></svg>; }
export function IconPlus({ className, ...props }: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true" {...props}><path d="M12 5v14M5 12h14"/></svg>; }
export function IconArrow({ className, ...props }: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true" {...props}><path d="M5 12h13M13 6l6 6-6 6"/></svg>; }
export function IconMenu({ className, ...props }: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true" {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>; }
