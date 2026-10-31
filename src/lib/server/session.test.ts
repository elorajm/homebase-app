import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCookies } from "@/lib/server/test-helpers";

const db = vi.hoisted(() => ({
  session: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/lib/server/db", () => ({ db }));

import {
  SESSION_COOKIE_NAME,
  createSession,
  createSessionToken,
  endSession,
  getCurrentUser,
  hashSessionToken,
  sessionCookieOptions,
} from "@/lib/server/session";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("session tokens", () => {
  it("hashes tokens with SHA-256 and is deterministic", () => {
    expect(hashSessionToken("abc")).toBe(sha256("abc"));
    expect(hashSessionToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("creates long, unique, URL-safe tokens", () => {
    const first = createSessionToken();
    const second = createSessionToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });
});

describe("session cookie", () => {
  it("is httpOnly, lax, scoped to /, and expires at the given time", () => {
    const expires = new Date("2030-01-01T00:00:00Z");
    expect(sessionCookieOptions(expires, false)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires,
    });
  });

  it("is secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions(new Date()).secure).toBe(true);
  });

  it("is not secure outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions(new Date()).secure).toBe(false);
  });
});

describe("createSession", () => {
  it("stores only the token hash and sets the raw token in the cookie", async () => {
    db.session.create.mockResolvedValue({});
    const cookies = fakeCookies();

    await createSession(cookies, "user_1");

    const { data } = db.session.create.mock.calls[0][0];
    const cookie = cookies.sets[0];
    expect(cookie.name).toBe(SESSION_COOKIE_NAME);
    expect(data.tokenHash).toBe(sha256(cookie.value));
    expect(data.tokenHash).not.toBe(cookie.value);
    expect(data.userId).toBe("user_1");
    expect(JSON.stringify(data)).not.toContain(cookie.value);
    expect(cookie.options.httpOnly).toBe(true);
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("getCurrentUser", () => {
  it("returns null without a cookie and without touching the database", async () => {
    expect(await getCurrentUser(fakeCookies())).toBeNull();
    expect(db.session.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for an unknown token", async () => {
    db.session.findUnique.mockResolvedValue(null);
    expect(await getCurrentUser(fakeCookies({ [SESSION_COOKIE_NAME]: "unknown" }))).toBeNull();
  });

  it("deletes an expired session and returns null", async () => {
    db.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
      user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    });

    expect(await getCurrentUser(fakeCookies({ [SESSION_COOKIE_NAME]: "old-token" }))).toBeNull();
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("old-token") },
    });
  });

  it("returns only the public user fields for a valid session", async () => {
    db.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    });

    const user = await getCurrentUser(fakeCookies({ [SESSION_COOKIE_NAME]: "live-token" }));

    expect(user).toEqual({ id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" });
    expect(db.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashSessionToken("live-token") } }),
    );
  });
});

describe("endSession", () => {
  it("deletes the stored session and clears the cookie", async () => {
    db.session.deleteMany.mockResolvedValue({ count: 1 });
    const cookies = fakeCookies({ [SESSION_COOKIE_NAME]: "live-token" });

    await endSession(cookies);

    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: hashSessionToken("live-token") } });
    expect(cookies.deletes).toEqual([{ name: SESSION_COOKIE_NAME, options: { path: "/" } }]);
  });

  it("still clears the cookie when there is no session", async () => {
    const cookies = fakeCookies();

    await endSession(cookies);

    expect(db.session.deleteMany).not.toHaveBeenCalled();
    expect(cookies.deletes).toHaveLength(1);
  });
});
