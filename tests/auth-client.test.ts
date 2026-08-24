import { describe, expect, it } from "vitest";

import { formatAuthError } from "../src/lib/auth-client";

describe("authentication error feedback", () => {
  it("does not configure a hardcoded client base URL", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/lib/auth-client.ts", import.meta.url), "utf8"),
    );

    expect(source).toContain("createAuthClient()");
    expect(source).not.toContain("localhost:");
  });

  it("preserves the server error code and message for actionable feedback", () => {
    expect(
      formatAuthError(
        { code: "AUTH_SERVER_ERROR", message: "Database unavailable" },
        "No se pudo autenticar",
      ),
    ).toBe("No se pudo autenticar (AUTH_SERVER_ERROR: Database unavailable)");
  });

  it("uses the fallback for non-auth errors", () => {
    expect(formatAuthError("unknown", "No se pudo autenticar")).toBe(
      "No se pudo autenticar",
    );
  });
});
