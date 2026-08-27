"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatAuthError, signUp } from "@/lib/auth-client";
import { AuthField, AuthFrame } from "@/components/AuthFrame";

export default function SignUpPage() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget); try { const result = await signUp.email({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")), callbackURL: "/" }); if (result.error) setError(formatAuthError(result.error, "No hemos podido crear tu cuenta. Revisa los datos o la configuración del servidor.")); else router.push("/"); } catch (error) { setError(formatAuthError(error, "No hemos podido crear tu cuenta. Revisa la conexión y la configuración del servidor.")); } finally { setBusy(false); } }
  return <AuthFrame title="Empieza a tu ritmo." description="Crea tu espacio personal para cuidar tus rutinas." onSubmit={submit} footer={<>¿Ya tienes cuenta? <a className="font-semibold text-[#ffb829]" href="/sign-in">Inicia sesión</a></>}><AuthField label="Tu nombre" name="name" placeholder="Cómo te llamas" required /><AuthField label="Correo electrónico" name="email" type="email" placeholder="tu@correo.com" required /><AuthField label="Contraseña" name="password" type="password" placeholder="Al menos 8 caracteres" required />{error && <p role="alert" className="text-sm text-[#ffb829]">{error}</p>}<button disabled={busy} className="iris-button h-12 w-full text-sm font-semibold uppercase tracking-[.08em] disabled:cursor-wait disabled:opacity-60">{busy ? "Creando tu espacio…" : "Crear cuenta"}</button></AuthFrame>;
}
