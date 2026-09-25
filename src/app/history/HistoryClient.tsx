"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreTask } from "@/app/actions/tasks";
import { DashboardShell } from "@/components/DashboardShell";
import { IconCalendar, IconHistory, IconHome, IconTarget } from "@/components/icons";
import { signOut } from "@/lib/auth-client";
import type { HistoryItem } from "@/lib/dal";

type HistoryData = { user: { name: string; email: string }; history: HistoryItem[] };

export default function HistoryClient({ data }: { data: HistoryData }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [busyId, setBusyId] = useState<string | null>(null);
  const navItems = [{ label: "Resumen", href: "/", active: false, icon: <IconHome className="size-5" /> }, { label: "Diarias", href: "/daily", active: false, icon: <IconCalendar className="size-5" /> }, { label: "Semanales", href: "/weekly", active: false, icon: <IconCalendar className="size-5" /> }, { label: "Proyectos", href: "/projects", active: false, icon: <IconTarget className="size-5" /> }, { label: "Eventos", href: "/events", active: false, icon: <IconCalendar className="size-5" /> }, { label: "Historial", href: "/history", active: true, icon: <IconHistory className="size-5" /> }];
  async function logout() { await signOut(); router.push("/inicio"); router.refresh(); }
  async function restore(item: HistoryItem) { setMessage(""); setBusyId(item.id); try { await restoreTask({ taskId: item.id }); router.refresh(); } catch { setMessage("No pudimos restaurar el elemento. Inténtalo de nuevo."); } finally { setBusyId(null); } }
  return <DashboardShell userName={data.user.name} navItems={navItems} onSignOut={logout} heading="Puedes recuperarlos" description="Proyectos y eventos que eliminaste. Restáuralos cuando quieras retomarlos.">
    {message && <p className="mb-6 text-base text-[#ffb829]" role="alert">{message}</p>}
    <section aria-labelledby="history-title">
      <div className="event-section-heading">
        <div><p className="event-eyebrow">Tu historial</p><h2 id="history-title" className="display-type mt-4 text-4xl text-white">Eliminados recientemente</h2><p className="mt-3 max-w-xl text-base leading-6 text-[#b8b8b8]">Los proyectos y eventos que apartaste siguen aquí, listos para volver.</p></div>
        <span className="event-count">{data.history.length} {data.history.length === 1 ? "elemento" : "elementos"}</span>
      </div>
      {data.history.length ? <ul className="mt-8 space-y-5">{data.history.map((item) => <li key={item.id}>
        <article className="rounded-2xl border border-[#24242a] bg-[#0c0c0f] px-5 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="event-eyebrow">{item.kind === "PROJECT" ? "Proyecto" : "Evento"}</p>
              <h3 className="mt-2 text-lg text-white">{item.title}</h3>
              {item.description && <p className="mt-1 text-sm leading-5 text-[#b8b8b8]">{item.description}</p>}
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#888]"><span>Inicio: <time dateTime={item.startDate} className="text-[#c0c0c0]">{readableDate(item.startDate)}</time></span><span>Eliminado: <time dateTime={item.deletedAt} className="text-[#c0c0c0]">{readableDateTime(item.deletedAt)}</time></span></p>
            </div>
            <button type="button" disabled={busyId === item.id} aria-label={`Restaurar ${item.title}`} onClick={() => void restore(item)} className="ghost-link min-h-11 shrink-0 self-start rounded-xl px-3 text-sm underline underline-offset-4 hover:bg-[#18151f] disabled:cursor-not-allowed disabled:opacity-40">Restaurar</button>
          </div>
        </article>
      </li>)}</ul> : <p className="mt-8 rounded-2xl border border-[#24242a] bg-[#0c0c0f] px-5 py-7 text-base text-[#b8b8b8]">Aún no has eliminado proyectos ni eventos.</p>}
    </section>
  </DashboardShell>;
}

function readableDate(dateKey: string) { return new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateKey}T12:00:00`)); }
function readableDateTime(iso: string) { return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); }
