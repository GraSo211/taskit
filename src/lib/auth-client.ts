import { createAuthClient } from "better-auth/react";

// Without a baseURL, Better Auth resolves `/api/auth` from window.location.
// This deliberately keeps browser auth requests on the origin serving Taskit.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, linkSocial } = authClient;

type AuthError = {
  code?: string;
  message?: string;
  status?: number;
};

export function formatAuthError(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;

  const authError = error as AuthError;
  const details = [authError.code, authError.message].filter(Boolean).join(": ");
  return details ? `${fallback} (${details})` : fallback;
}
