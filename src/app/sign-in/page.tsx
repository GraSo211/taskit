"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAuthError, signIn } from "@/lib/auth-client";
import { AuthFrame } from "@/components/AuthFrame";

export default function SignInPage() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function continueWithGoogle() { setBusy(true); setError(""); try { const result = await signIn.social({ provider: "google" }); if (result.error) setError(formatAuthError(result.error, "No hemos podido continuar con Google. Inténtalo de nuevo.")); else router.push("/"); } catch (error) { setError(formatAuthError(error, "No hemos podido continuar con Google. Revisa la conexión e inténtalo de nuevo.")); } finally { setBusy(false); } }
  return <AuthFrame title="Qué bueno verte." description="Entra con tu cuenta de Google y continúa con tu ritmo." footer="Taskit usa Google para proteger tu acceso."><button type="button" disabled={busy} aria-busy={busy} onClick={() => void continueWithGoogle()} className="iris-button h-12 w-full text-sm font-semibold uppercase tracking-[.08em] disabled:cursor-wait disabled:opacity-60">{busy ? "Abriendo Google…" : "Continuar con Google"}</button>{error && <p role="alert" className="text-sm text-[#ffb829]">{error}</p>}</AuthFrame>;
}
