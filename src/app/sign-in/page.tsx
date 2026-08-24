"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatAuthError, signIn } from "@/lib/auth-client";
import { AuthField, AuthFrame } from "@/components/AuthFrame";

export default function SignInPage() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget); try { const result = await signIn.email({ email: String(data.get("email")), password: String(data.get("password")), callbackURL: "/dashboard" }); if (result.error) setError(formatAuthError(result.error, "No hemos podido iniciar sesión. Revisa tus datos o la configuración del servidor.")); else router.push("/dashboard"); } catch (error) { setError(formatAuthError(error, "No hemos podido iniciar sesión. Revisa la conexión y la configuración del servidor.")); } finally { setBusy(false); } }
  return <AuthFrame title="Qué bueno verte." description="Entra a tu espacio y continúa con tu ritmo." onSubmit={submit} footer={<>¿Aún no tienes cuenta? <a className="font-semibold text-[#ffb829]" href="/sign-up">Crea una gratis</a></>}><AuthField label="Correo electrónico" name="email" type="email" placeholder="tu@correo.com" required /><AuthField label="Contraseña" name="password" type="password" placeholder="Tu contraseña" required />{error && <p role="alert" className="text-sm text-[#ffb829]">{error}</p>}<button disabled={busy} className="iris-button h-12 w-full text-sm font-semibold uppercase tracking-[.08em] disabled:cursor-wait disabled:opacity-60">{busy ? "Entrando…" : "Iniciar sesión"}</button></AuthFrame>;
}
