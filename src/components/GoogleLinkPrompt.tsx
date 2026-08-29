"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function GoogleLinkPrompt() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function linkGoogle() { setBusy(true); setError(""); try { const result = await authClient.linkSocial({ provider: "google", callbackURL: window.location.href }); if (result.error) setError("Google todavía no está disponible. Puedes seguir entrando con tu cuenta local."); } catch { setError("Google todavía no está disponible. Puedes seguir entrando con tu cuenta local."); } finally { setBusy(false); } }
  return <aside className="google-link-card" aria-labelledby="google-link-title" aria-describedby="google-link-description"><div><p className="event-eyebrow">Transición de cuenta</p><h2 id="google-link-title">Vincula Google cuando te venga bien.</h2><p id="google-link-description">Tu acceso local seguirá disponible mientras completas el cambio.</p></div><button type="button" className="iris-button google-link-button" disabled={busy} aria-busy={busy} onClick={() => void linkGoogle()}>{busy ? "Abriendo Google…" : "Vincular Google"}</button>{error && <p className="google-link-error" role="alert">{error}</p>}</aside>;
}
