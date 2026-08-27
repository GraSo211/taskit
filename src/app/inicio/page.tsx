import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function LandingPage() {
  return <main className="paper-grain min-h-screen overflow-hidden bg-black">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-10 sm:py-8">
      <BrandMark />
      <nav className="flex items-center gap-4 text-sm sm:gap-8" aria-label="Acceso a tu cuenta">
        <Link href="/sign-in" className="ghost-link hidden sm:inline">Iniciar sesión</Link>
        <Link href="/sign-up" className="iris-button inline-flex min-h-11 items-center px-5 text-xs font-semibold uppercase tracking-[.08em]">Crear cuenta</Link>
      </nav>
    </header>
    <section className="mx-auto grid min-h-[calc(100vh-92px)] max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-10 sm:pb-24 sm:pt-20 lg:grid-cols-[.95fr_1.05fr] lg:gap-16">
      <div className="relative z-10">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ffb829] sm:text-sm">Tareas que encuentran su ritmo</p>
        <h1 className="display-type mt-6 max-w-3xl text-[clamp(3.7rem,12vw,7rem)] leading-[.91] text-white sm:mt-7">Haz espacio para lo que importa<span className="text-[#8052ff]">.</span></h1>
        <p className="mt-8 max-w-lg text-base leading-7 text-[#bdbdbd] sm:mt-10 sm:text-lg sm:leading-8">Taskit convierte tus intenciones en rutinas claras, sin ruido y sin perder de vista el día que tienes delante.</p>
        <div className="mt-8 flex flex-wrap items-center gap-5 sm:mt-10"><Link href="/sign-up" className="iris-button inline-flex min-h-12 items-center px-6 text-sm font-semibold uppercase tracking-[.08em]">Empezar ahora</Link><Link href="/sign-in" className="ghost-link text-sm underline underline-offset-4 sm:hidden">Ya tengo cuenta</Link></div>
      </div>
      <div className="relative min-h-[300px] sm:min-h-[460px]" aria-hidden="true">
        <span className="absolute left-[18%] top-[25%] size-2 rotate-45 bg-[#ffb829]"/><span className="absolute left-[42%] top-[12%] size-3 rotate-45 bg-[#8052ff]"/><span className="absolute left-[70%] top-[34%] size-2 rotate-45 bg-[#15846e]"/><span className="absolute left-[32%] top-[56%] size-2 rotate-45 bg-[#8052ff]"/><span className="absolute left-[61%] top-[65%] size-3 rotate-45 bg-[#ffb829]"/>
        <div className="absolute left-[18%] top-[22%] size-48 rounded-[45%] border border-[#8052ff]/40 [transform:rotate(-24deg)] sm:left-[24%] sm:top-[30%] sm:size-56"/><div className="absolute left-[36%] top-[34%] size-40 rounded-[45%] border border-[#ffb829]/30 [transform:rotate(36deg)] sm:left-[38%] sm:top-[40%] sm:size-48"/>
        <p className="absolute bottom-3 left-[18%] max-w-xs text-sm leading-6 text-[#9a9a9a] sm:bottom-10 sm:left-1/4">Una vista serena de tus tareas diarias y tus metas semanales.</p>
      </div>
    </section>
  </main>;
}
