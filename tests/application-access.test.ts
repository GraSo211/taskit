import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { getCurrentUser, isAllowedApplicationEmail } = await import("../src/lib/dal");

describe("application access allowlist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("compares the configured email case-insensitively", () => {
    expect(isAllowedApplicationEmail("SANTIGS211@GMAIL.COM")).toBe(true);
    expect(isAllowedApplicationEmail("other@example.com")).toBe(false);
    expect(isAllowedApplicationEmail(undefined)).toBe(false);
  });

  it("rejects authenticated users outside the application allowlist", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1", name: "Other", email: "other@example.com", image: null },
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
