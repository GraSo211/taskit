import { createAuthClient } from "better-auth/react";

// Without a baseURL, Better Auth resolves `/api/auth` from window.location.
// This deliberately keeps browser auth requests on the origin serving Taskit.
export const authClient = createAuthClient();

// The server exposes Google sign-in only; signIn is retained for its
// signIn.social method. No account-linking client action is exported.
export const { signIn, signOut, useSession } = authClient;

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
