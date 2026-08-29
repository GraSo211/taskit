import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

import { isAllowedApplicationEmail, validateUserInfo } from "../src/lib/allowlist";

describe("authentication allowlist", () => {
  it("accepts only the retained email, case-insensitively", () => {
    expect(isAllowedApplicationEmail("SANTIGS211@GMAIL.COM")).toBe(true);
    expect(isAllowedApplicationEmail("other@example.com")).toBe(false);
    expect(isAllowedApplicationEmail(null)).toBe(false);
  });

  it("rejects user information without the retained email", () => {
    expect(validateUserInfo({ email: "other@example.com" })).toBe(false);
    expect(validateUserInfo({ email: "santigs211@gmail.com" })).toBe(true);
  });

  it("keeps the auth boundary before local session issuance", async () => {
    const source = await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8");

    expect(source).toContain('context.path !== "/sign-in/email"');
    expect(source).toContain('code: "APPLICATION_ACCESS_DENIED"');
    expect(source).toContain("disableSignUp: true");
    expect(source).toContain("disableImplicitSignUp: true");
    expect(source).toContain("disableImplicitLinking: true");
    expect(source).toContain("requireLocalEmailVerified: false");
    expect(source).toContain("trustedProviders: []");
    expect(source).not.toContain("requireEmailVerification");
  });
});
