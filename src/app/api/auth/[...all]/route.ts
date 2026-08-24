import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const authHandlers = toNextJsHandler(auth);

async function handleAuthRequest(
  request: Request,
  method: keyof typeof authHandlers,
) {
  const response = await authHandlers[method](request);

  // Better Auth intentionally returns an empty 500 response for some adapter
  // failures. Keep the server log intact, but give the client an actionable
  // error instead of making the form appear to do nothing.
  if (response.status >= 500) {
    return Response.json(
      {
        error: {
          code: "AUTH_SERVER_ERROR",
          message:
            "El servidor de autenticación no está disponible. Comprueba DATABASE_URL, PostgreSQL y que hayas aplicado la migración de Prisma.",
        },
      },
      { status: response.status },
    );
  }

  return response;
}

export const GET = (request: Request) => handleAuthRequest(request, "GET");
export const POST = (request: Request) => handleAuthRequest(request, "POST");
export const PATCH = (request: Request) => handleAuthRequest(request, "PATCH");
export const PUT = (request: Request) => handleAuthRequest(request, "PUT");
export const DELETE = (request: Request) => handleAuthRequest(request, "DELETE");
