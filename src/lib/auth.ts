import { APIError, betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import type { GoogleProfile } from "better-auth/social-providers";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/prisma";
import { isAllowedApplicationEmail, validateUserInfo } from "@/lib/allowlist";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const isConfiguredCredential = (value: string | undefined) =>
  Boolean(value && !value.startsWith("replace-with-"));
const googleOAuthConfigured =
  isConfiguredCredential(googleClientId) && isConfiguredCredential(googleClientSecret);
const googleProvider = googleOAuthConfigured
  ? {
      clientId: googleClientId as string,
      clientSecret: googleClientSecret as string,
      disableSignUp: true,
      disableImplicitSignUp: true,
      mapProfileToUser: (profile: GoogleProfile) => {
        if (!profile.email_verified) {
          throw APIError.from("FORBIDDEN", {
            code: "GOOGLE_EMAIL_NOT_VERIFIED",
            message: "Google must report a verified email address",
          });
        }
        if (!isAllowedApplicationEmail(profile.email)) {
          throw APIError.from("FORBIDDEN", {
            code: "APPLICATION_ACCESS_DENIED",
            message: "This account is not allowed to access the application",
          });
        }
        return { emailVerified: true };
      },
    }
  : undefined;

const allowlistedEmailBeforeSignIn = createAuthMiddleware(async (context) => {
  if (context.path !== "/sign-in/email") return;

  const body = context.body as { email?: unknown } | undefined;
  if (typeof body?.email !== "string" || !isAllowedApplicationEmail(body.email)) {
    throw APIError.from("FORBIDDEN", {
      code: "APPLICATION_ACCESS_DENIED",
      message: "This account is not allowed to access the application",
    });
  }
});

// Keep local builds and tests usable without OAuth credentials, while refusing
// to start a production server with an incomplete Google configuration.
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !googleOAuthConfigured
) {
  throw new Error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production",
  );
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: googleProvider ? { google: googleProvider } : {},
  account: {
    accountLinking: {
      enabled: false,
      disableImplicitLinking: true,
      trustedProviders: [],
      allowDifferentEmails: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!validateUserInfo(user)) return false;
        },
      },
    },
    account: {
      create: {
        before: async (account) => {
          const user = await prisma.user.findUnique({
            where: { id: account.userId },
            select: { email: true },
          });
          if (!user || !validateUserInfo(user)) return false;
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { email: true },
          });
          if (!user || !validateUserInfo(user)) return false;
        },
      },
    },
  },
  hooks: {
    before: allowlistedEmailBeforeSignIn,
  },
  plugins: [nextCookies()],
});
